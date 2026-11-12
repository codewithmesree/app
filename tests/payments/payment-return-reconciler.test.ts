import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  captureIdempotencyKey,
  createInflightRegistry,
  reconcileDelayMs,
  reconcilePaymentReturn,
  RECONCILE_MAX_DURATION_MS,
  type ReturnOutcome,
} from "@/lib/payments/payment-return-reconciler";
import {
  POST_PAYMENT_REDIRECT_DELAY_MS,
  POST_PAYMENT_REDIRECT_PATH,
  shouldRedirectAfterPayment,
} from "@/lib/payments/post-payment-redirect";

const TOKEN = "PAYPAL_ORDER_123";
const TXN = "txn_abc";

type Reply = { status: number; body?: unknown } | Error;

/**
 * Fake browser environment: scripted capture replies, a virtual clock that
 * advances only when the reconciler sleeps, and a record of every request.
 */
function harness(captureReplies: Reply[], options: { resolve?: Reply[]; captureGate?: Promise<void> } = {}) {
  let clock = 0;
  const sleeps: number[] = [];
  const captureBodies: Array<{ transactionId: string; idempotencyKey: string }> = [];
  let resolveCalls = 0;
  const resolveReplies = options.resolve ?? [{ status: 200, body: { transactionId: TXN, status: "AWAITING_APPROVAL" } }];
  const toResponse = (reply: Reply) => {
    if (reply instanceof Error) throw reply;
    return new Response(JSON.stringify(reply.body ?? {}), { status: reply.status });
  };

  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("/api/payments/paypal/resolve")) {
      const reply = resolveReplies[Math.min(resolveCalls, resolveReplies.length - 1)];
      resolveCalls++;
      return toResponse(reply);
    }
    if (url === "/api/payments/paypal/capture") {
      captureBodies.push(JSON.parse(String(init?.body)));
      const reply = captureReplies[Math.min(captureBodies.length - 1, captureReplies.length - 1)];
      await options.captureGate;
      return toResponse(reply);
    }
    throw new Error(`unexpected fetch ${url}`);
  }) as typeof fetch;

  return {
    deps: {
      fetch: fetchImpl,
      now: () => clock,
      sleep: async (ms: number) => {
        sleeps.push(ms);
        clock += ms;
      },
      registry: createInflightRegistry(),
    },
    sleeps,
    captureBodies,
    get resolveCalls() {
      return resolveCalls;
    },
    get elapsed() {
      return clock;
    },
  };
}

const completed = (id = "CAP_1") => ({
  status: 200,
  body: { transactionId: TXN, status: "COMPLETED", amount: "50.00", currency: "SGD", providerCaptureId: id },
});
const uncertain = { status: 202, body: { transactionId: TXN, status: "STATUS_UNKNOWN", amount: "50.00", currency: "SGD" } };
const capturePending = { status: 202, body: { transactionId: TXN, status: "CAPTURE_PENDING", amount: "50.00", currency: "SGD" } };

function assertCompleted(outcome: ReturnOutcome | null): asserts outcome is Extract<ReturnOutcome, { kind: "completed" }> {
  assert.ok(outcome);
  assert.strictEqual(outcome.kind, "completed");
}

describe("PayPal return page automatic reconciliation", () => {
  it("1. capture that immediately returns COMPLETED shows success with a single request and no polling", async () => {
    const h = harness([completed()]);
    const outcome = await reconcilePaymentReturn(TOKEN, h.deps);
    assertCompleted(outcome);
    assert.strictEqual(outcome.payment.providerCaptureId, "CAP_1");
    assert.strictEqual(h.captureBodies.length, 1);
    assert.deepStrictEqual(h.sleeps, []);
  });

  it("2. uncertain capture result is followed by automatic checks until COMPLETED", async () => {
    const h = harness([uncertain, capturePending, completed()]);
    const progress: number[] = [];
    const outcome = await reconcilePaymentReturn(TOKEN, { ...h.deps, onProgress: (p) => progress.push(p.checks) });
    assertCompleted(outcome);
    assert.strictEqual(h.captureBodies.length, 3);
    assert.deepStrictEqual(h.sleeps, [2_000, 2_000]);
    assert.deepStrictEqual(progress, [1, 2]);
  });

  it("3. a timed-out capture request is retried rather than treated as a final result", async () => {
    const h = harness([new TypeError("Failed to fetch"), { status: 504, body: {} }, completed()]);
    const outcome = await reconcilePaymentReturn(TOKEN, h.deps);
    assertCompleted(outcome);
    assert.strictEqual(h.captureBodies.length, 3);
  });

  it("4. a persistently PENDING payment keeps polling with backoff, then falls back to Under Review", async () => {
    const h = harness([uncertain]);
    const outcome = await reconcilePaymentReturn(TOKEN, h.deps);
    assert.ok(outcome);
    assert.strictEqual(outcome.kind, "under_review");
    assert.ok(h.elapsed <= RECONCILE_MAX_DURATION_MS, `polled for ${h.elapsed}ms`);
    assert.ok(h.elapsed >= RECONCILE_MAX_DURATION_MS - 5_000, `gave up early at ${h.elapsed}ms`);
    assert.strictEqual(h.sleeps[0], 2_000);
    assert.ok(h.sleeps.every((ms) => ms >= 2_000 && ms <= 5_000));
    assert.ok(h.captureBodies.length >= 10 && h.captureBodies.length <= 30, `${h.captureBodies.length} checks`);
  });

  it("5. PayPal FAILED/DENIED capture stops polling and shows the failed status", async () => {
    const h = harness([{ status: 200, body: { transactionId: TXN, status: "FAILED", amount: "50.00", currency: "SGD" } }]);
    const outcome = await reconcilePaymentReturn(TOKEN, h.deps);
    assert.deepStrictEqual(outcome, { kind: "failed", status: "FAILED", transactionId: TXN });
    assert.strictEqual(h.captureBodies.length, 1);
    assert.deepStrictEqual(h.sleeps, []);
  });

  it("6. a cancelled payment shows CANCELLED from the authoritative transaction status", async () => {
    const h = harness(
      [{ status: 409, body: { error: { code: "TRANSACTION_STATE_CONFLICT", message: "No active PayPal order" } } }],
      {
        resolve: [
          { status: 200, body: { transactionId: TXN, status: "AWAITING_APPROVAL" } },
          { status: 200, body: { transactionId: TXN, status: "CANCELLED" } },
        ],
      }
    );
    const outcome = await reconcilePaymentReturn(TOKEN, h.deps);
    assert.deepStrictEqual(outcome, { kind: "failed", status: "CANCELLED", transactionId: TXN });
    assert.deepStrictEqual(h.sleeps, []);
  });

  it("7. every capture and poll reuses one deterministic idempotency key", async () => {
    const h = harness([uncertain, uncertain, completed()]);
    await reconcilePaymentReturn(TOKEN, h.deps);
    const expected = captureIdempotencyKey(TXN, TOKEN);
    assert.ok(h.captureBodies.every((b) => b.idempotencyKey === expected && b.transactionId === TXN));
    assert.strictEqual(h.resolveCalls, 1); // transaction id resolved once, then cached
  });

  it("8. React Strict Mode (mount, unmount, remount) sends one capture request", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const h = harness([completed()], { captureGate: gate });

    // First effect run, immediately cleaned up as Strict Mode does in development.
    const firstController = new AbortController();
    const first = reconcilePaymentReturn(TOKEN, { ...h.deps, signal: firstController.signal });
    await new Promise((resolve) => setImmediate(resolve));
    firstController.abort();
    // Second effect run while the first capture request is still in flight.
    const second = reconcilePaymentReturn(TOKEN, h.deps);
    await new Promise((resolve) => setImmediate(resolve));
    release();

    assert.strictEqual(await first, null); // aborted run never updates state
    assertCompleted(await second);
    assert.strictEqual(h.captureBodies.length, 1);
  });

  it("9. polling stops as soon as a definitive status arrives", async () => {
    const h = harness([uncertain, completed(), uncertain, uncertain]);
    const outcome = await reconcilePaymentReturn(TOKEN, h.deps);
    assertCompleted(outcome);
    assert.strictEqual(h.captureBodies.length, 2);
    assert.strictEqual(h.sleeps.length, 1);
  });

  it("10. after the window ends, the manual Check Status Again run starts a fresh window and can confirm", async () => {
    const h = harness([uncertain]);
    const first = await reconcilePaymentReturn(TOKEN, { ...h.deps, maxDurationMs: 10_000 });
    assert.strictEqual(first?.kind, "under_review");
    const checksAfterWindow = h.captureBodies.length;

    // No more requests happen until the user asks.
    await new Promise((resolve) => setImmediate(resolve));
    assert.strictEqual(h.captureBodies.length, checksAfterWindow);

    const h2 = harness([completed()]);
    const manual = await reconcilePaymentReturn(TOKEN, h2.deps);
    assertCompleted(manual);
  });

  it("11. only a confirmed COMPLETED outcome triggers the 2.5s dashboard redirect", async () => {
    const ok = await reconcilePaymentReturn(TOKEN, harness([completed()]).deps);
    assertCompleted(ok);
    assert.strictEqual(shouldRedirectAfterPayment(ok.payment), true);
    assert.strictEqual(POST_PAYMENT_REDIRECT_PATH, "/dashboard");
    assert.strictEqual(POST_PAYMENT_REDIRECT_DELAY_MS, 2_500);

    const review = await reconcilePaymentReturn(TOKEN, { ...harness([uncertain]).deps, maxDurationMs: 4_000 });
    assert.strictEqual(review?.kind, "under_review");
    assert.strictEqual(shouldRedirectAfterPayment(review?.kind === "under_review" ? review.payment : null), false);
  });

  it("12. an unknown order token is a final error and is not polled", async () => {
    const h = harness([completed()], {
      resolve: [{ status: 404, body: { error: { code: "NOT_FOUND", message: "Payment order not found for this session." } } }],
    });
    const outcome = await reconcilePaymentReturn(TOKEN, h.deps);
    assert.deepStrictEqual(outcome, { kind: "error", message: "Payment order not found for this session." });
    assert.strictEqual(h.captureBodies.length, 0);
    assert.deepStrictEqual(h.sleeps, []);
  });

  it("starts at 2s and backs off to at most 5s between checks", () => {
    assert.deepStrictEqual([1, 2, 3, 4, 5, 6, 20].map(reconcileDelayMs), [2_000, 2_000, 2_000, 3_000, 4_000, 5_000, 5_000]);
  });
});

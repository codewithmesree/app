// =============================================================================
// GlobalPay — PayPal return-page reconciler (client side)
// =============================================================================
// After PayPal redirects the buyer to /pay/return, this drives the payment to a
// definitive state without user interaction:
//   1. resolve the PayPal token to the session-owned transaction,
//   2. ask the server to capture (or reconcile) it,
//   3. while the server reports CAPTURE_PENDING / STATUS_UNKNOWN or is briefly
//      unreachable, ask again with backoff for up to RECONCILE_MAX_DURATION_MS.
//
// Every request reuses one deterministic idempotency key per order. The server
// (idempotency record + per-attempt capture lease + stable PayPal-Request-Id)
// is what guarantees a single capture. The in-flight sharing here only avoids
// redundant requests from React Strict Mode double effects and remounts.
// =============================================================================

export const RECONCILE_INITIAL_INTERVAL_MS = 2_000;
export const RECONCILE_MAX_INTERVAL_MS = 5_000;
export const RECONCILE_MAX_DURATION_MS = 60_000;

export interface CapturedPayment {
  transactionId: string;
  status: string;
  amount: string;
  currency: string;
  capturedAt?: string;
  providerCaptureId?: string;
}

export type ReturnOutcome =
  | { kind: "completed"; payment: CapturedPayment }
  | { kind: "failed"; status: "FAILED" | "CANCELLED"; transactionId?: string }
  /** Still not definitive after the polling window; the manual check remains available. */
  | { kind: "under_review"; payment?: CapturedPayment }
  /** A non-retryable problem (no matching order, session expired, order not approved...). */
  | { kind: "error"; message: string };

export interface ReconcileProgress {
  /** Number of completed server checks so far. */
  checks: number;
  lastStatus?: string;
}

export interface ReconcileDeps {
  fetch?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  /** Shared in-flight request registry; injectable for tests. */
  registry?: InflightRegistry;
}

export interface InflightRegistry {
  transactionIds: Map<string, string>;
  captures: Map<string, Promise<CheckResult>>;
}

export type CheckResult =
  | { kind: "final"; outcome: ReturnOutcome }
  | { kind: "pending"; payment?: CapturedPayment; status?: string };

export function createInflightRegistry(): InflightRegistry {
  return { transactionIds: new Map(), captures: new Map() };
}

const defaultRegistry = createInflightRegistry();

/** 2s, 2s, 2s, 3s, 4s, then 5s between checks. */
export function reconcileDelayMs(checksSoFar: number): number {
  return Math.min(
    RECONCILE_INITIAL_INTERVAL_MS + Math.max(0, checksSoFar - 3) * 1_000,
    RECONCILE_MAX_INTERVAL_MS
  );
}

export function captureIdempotencyKey(transactionId: string, token: string): string {
  return `capture_${transactionId}_${token}`;
}

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

async function readJson(response: Response): Promise<Record<string, unknown> | null> {
  const data: unknown = await response.json().catch(() => null);
  return typeof data === "object" && data !== null ? (data as Record<string, unknown>) : null;
}

function errorMessage(data: Record<string, unknown> | null, fallback: string): string {
  const error = data?.error;
  if (typeof error === "object" && error !== null) {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}

/** Network blips, timeouts, rate limits and 5xx are worth retrying; other 4xx are not. */
function isTransientStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function toPayment(data: Record<string, unknown>): CapturedPayment | null {
  if (typeof data.transactionId !== "string" || typeof data.status !== "string") return null;
  return {
    transactionId: data.transactionId,
    status: data.status,
    amount: typeof data.amount === "string" ? data.amount : "",
    currency: typeof data.currency === "string" ? data.currency : "",
    capturedAt: typeof data.capturedAt === "string" ? data.capturedAt : undefined,
    providerCaptureId: typeof data.providerCaptureId === "string" ? data.providerCaptureId : undefined,
  };
}

function classifyTransactionStatus(status: unknown, transactionId?: string): CheckResult | null {
  if (status === "FAILED" || status === "CANCELLED") {
    return { kind: "final", outcome: { kind: "failed", status, transactionId } };
  }
  return null;
}

type ResolveResult =
  | { kind: "ok"; transactionId: string; status?: string }
  | { kind: "check"; result: CheckResult };

async function resolveTransaction(
  token: string,
  fetchImpl: typeof fetch,
  registry: InflightRegistry,
  fresh = false
): Promise<ResolveResult> {
  const cached = registry.transactionIds.get(token);
  if (cached && !fresh) return { kind: "ok", transactionId: cached };

  let response: Response;
  try {
    response = await fetchImpl(`/api/payments/paypal/resolve?token=${encodeURIComponent(token)}`, {
      cache: "no-store",
    });
  } catch {
    return { kind: "check", result: { kind: "pending" } };
  }
  const data = await readJson(response);
  if (!response.ok) {
    if (isTransientStatus(response.status)) return { kind: "check", result: { kind: "pending" } };
    return {
      kind: "check",
      result: {
        kind: "final",
        outcome: { kind: "error", message: errorMessage(data, "Could not resolve matching transaction for this order.") },
      },
    };
  }
  const transactionId = typeof data?.transactionId === "string" ? data.transactionId : null;
  if (!transactionId) return { kind: "check", result: { kind: "pending" } };
  registry.transactionIds.set(token, transactionId);
  return { kind: "ok", transactionId, status: typeof data?.status === "string" ? data.status : undefined };
}

async function requestCapture(
  token: string,
  transactionId: string,
  fetchImpl: typeof fetch,
  registry: InflightRegistry
): Promise<CheckResult> {
  let response: Response;
  try {
    response = await fetchImpl("/api/payments/paypal/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ transactionId, idempotencyKey: captureIdempotencyKey(transactionId, token) }),
    });
  } catch {
    // The request may or may not have reached the server; the next check reconciles.
    return { kind: "pending" };
  }

  const data = await readJson(response);
  if (response.ok && data) {
    const payment = toPayment(data);
    if (!payment) return { kind: "pending" };
    if (payment.status === "COMPLETED") {
      return { kind: "final", outcome: { kind: "completed", payment } };
    }
    return classifyTransactionStatus(payment.status, payment.transactionId)
      ?? { kind: "pending", payment, status: payment.status };
  }

  if (isTransientStatus(response.status)) return { kind: "pending" };

  // A 4xx means the server would not capture. Ask for the authoritative
  // transaction status so a cancelled/failed payment shows its real outcome.
  const resolved = await resolveTransaction(token, fetchImpl, registry, true);
  if (resolved.kind === "check") return resolved.result;
  const final = classifyTransactionStatus(resolved.status, resolved.transactionId);
  if (final) return final;
  if (resolved.status === "CAPTURE_PENDING" || resolved.status === "STATUS_UNKNOWN" || resolved.status === "COMPLETED") {
    return { kind: "pending", status: resolved.status };
  }
  return {
    kind: "final",
    outcome: { kind: "error", message: errorMessage(data, "Failed to capture payment.") },
  };
}

/** One server check. Concurrent callers for the same token share one request. */
async function checkOnce(token: string, fetchImpl: typeof fetch, registry: InflightRegistry): Promise<CheckResult> {
  const inflight = registry.captures.get(token);
  if (inflight) return inflight;

  const request = (async (): Promise<CheckResult> => {
    const resolved = await resolveTransaction(token, fetchImpl, registry);
    if (resolved.kind === "check") return resolved.result;
    return requestCapture(token, resolved.transactionId, fetchImpl, registry);
  })();

  registry.captures.set(token, request);
  const clear = () => {
    if (registry.captures.get(token) === request) registry.captures.delete(token);
  };
  request.then(clear, clear);
  return request;
}

/**
 * Drives a returning PayPal order to a definitive outcome. Resolves with
 * `under_review` if nothing definitive arrives within the polling window, or
 * with `null` if aborted (e.g. the component unmounted).
 */
export async function reconcilePaymentReturn(
  token: string,
  options: ReconcileDeps & {
    signal?: AbortSignal;
    onProgress?: (progress: ReconcileProgress) => void;
    maxDurationMs?: number;
  } = {}
): Promise<ReturnOutcome | null> {
  const fetchImpl = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  const registry = options.registry ?? defaultRegistry;
  const maxDurationMs = options.maxDurationMs ?? RECONCILE_MAX_DURATION_MS;
  const { signal } = options;

  const startedAt = now();
  let checks = 0;
  let lastPayment: CapturedPayment | undefined;

  while (!signal?.aborted) {
    const result = await checkOnce(token, fetchImpl, registry);
    if (signal?.aborted) return null;
    checks += 1;

    if (result.kind === "final") return result.outcome;

    lastPayment = result.payment ?? lastPayment;
    options.onProgress?.({ checks, lastStatus: result.status });

    const delay = reconcileDelayMs(checks);
    if (now() - startedAt + delay > maxDurationMs) {
      return { kind: "under_review", payment: lastPayment };
    }
    await sleep(delay, signal);
  }
  return null;
}

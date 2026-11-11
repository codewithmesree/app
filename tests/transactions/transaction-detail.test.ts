import { randomUUID } from "node:crypto";
import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PaymentAttemptStatus,
  PaymentEnvironment,
  PaymentProvider,
  Prisma,
  TransactionStatus,
} from "@prisma/client";
import { GET as transactionDetailGetHandler } from "@/app/api/transactions/[id]/route";
import { createDemoSession } from "@/lib/auth/session-service";
import { db } from "@/lib/db";
import { seedDemoMerchants } from "@/lib/merchants/merchant-service";

const createdAt = new Date("2026-10-31T12:00:00.000Z");
const quoteAsOf = new Date("2026-10-31T11:55:00.000Z");
const completedAt = new Date("2026-10-31T12:04:00.000Z");

type FixtureOptions = {
  status?: TransactionStatus;
  attemptStatus?: PaymentAttemptStatus;
  providerCaptureId?: string | null;
};

async function createTransactionFixture(options: FixtureOptions = {}) {
  const { session, rawToken } = await createDemoSession();
  const merchant = await db.merchant.findUnique({ where: { slug: "kyoto-ryokan-stay" } });
  assert.ok(merchant);

  const quote = await db.currencyQuote.create({
    data: {
      baseAmount: new Prisma.Decimal("25000"),
      baseCurrency: "JPY",
      convertedAmount: new Prisma.Decimal("160"),
      quoteCurrency: "USD",
      rate: new Prisma.Decimal("0.0064"),
      source: "transaction-detail-test",
      asOf: quoteAsOf,
      isIndicative: true,
    },
  });

  const status = options.status ?? TransactionStatus.COMPLETED;
  const attemptStatus = options.attemptStatus ?? PaymentAttemptStatus.COMPLETED;
  const captureId =
    options.providerCaptureId === undefined
      ? `CAPTURE_TEST_${randomUUID()}`
      : options.providerCaptureId;

  const transaction = await db.transaction.create({
    data: {
      demoSessionId: session.id,
      merchantId: merchant.id,
      currencyQuoteId: quote.id,
      amount: new Prisma.Decimal("25000"),
      currency: "JPY",
      homeCurrency: "USD",
      indicativeRate: new Prisma.Decimal("0.0064"),
      estimatedHomeAmount: new Prisma.Decimal("160"),
      quoteSnapshot: {
        quoteId: quote.id,
        source: quote.source,
        rate: quote.rate.toString(),
        asOf: quote.asOf.toISOString(),
        baseCurrency: quote.baseCurrency,
        quoteCurrency: quote.quoteCurrency,
      },
      status,
      createdAt,
      completedAt: status === TransactionStatus.COMPLETED ? completedAt : null,
      paymentAttempts: {
        create: {
          provider: PaymentProvider.PAYPAL,
          environment: PaymentEnvironment.SANDBOX,
          status: attemptStatus,
          providerCaptureId: captureId,
          amount: new Prisma.Decimal("25000"),
          currency: "JPY",
          capturedAt: attemptStatus === PaymentAttemptStatus.COMPLETED ? completedAt : null,
        },
      },
    },
  });

  return { transaction, session, rawToken, merchant };
}

async function requestTransaction(rawToken: string, transactionId: string) {
  const request = new Request(`http://localhost:3000/api/transactions/${transactionId}`, {
    headers: { Cookie: `gp_session=${rawToken}` },
  });

  return transactionDetailGetHandler(request, {
    params: Promise.resolve({ id: transactionId }),
  });
}

describe("Transaction detail receipt API", () => {
  before(async () => {
    await seedDemoMerchants();
  });

  it("returns the owned transaction's exact receipt data and verified capture reference", async () => {
    const fixture = await createTransactionFixture();
    const response = await requestTransaction(fixture.rawToken, fixture.transaction.id);
    const json = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(json.transaction.id, fixture.transaction.id);
    assert.strictEqual(json.transaction.merchant.name, fixture.merchant.name);
    assert.strictEqual(json.transaction.merchant.countryCode, fixture.merchant.countryCode);
    assert.strictEqual(json.transaction.amount, fixture.transaction.amount.toString());
    assert.strictEqual(json.transaction.currency, "JPY");
    assert.strictEqual(json.transaction.status, "COMPLETED");
    assert.strictEqual(json.transaction.createdAt, createdAt.toISOString());
    assert.strictEqual(json.transaction.completedAt, completedAt.toISOString());
    assert.strictEqual(json.transaction.indicativeEstimate.estimatedHomeAmount, "160");
    assert.strictEqual(json.transaction.indicativeEstimate.homeCurrency, "USD");
    assert.strictEqual(json.transaction.indicativeEstimate.rate, "0.0064");
    assert.strictEqual(json.transaction.indicativeEstimate.baseCurrency, "JPY");
    assert.strictEqual(json.transaction.indicativeEstimate.quoteCurrency, "USD");
    assert.strictEqual(json.transaction.indicativeEstimate.asOf, quoteAsOf.toISOString());
    assert.match(json.transaction.providerCaptureId, /^CAPTURE_TEST_/);

    for (const field of [
      "demoSessionId",
      "feeBreakdown",
      "paymentAttempts",
      "events",
      "operations",
      "tokenHash",
      "idempotencyKey",
      "providerOrderId",
    ]) {
      assert.strictEqual(Object.hasOwn(json.transaction, field), false);
    }
  });

  it("omits a missing optional provider capture reference", async () => {
    const fixture = await createTransactionFixture({ providerCaptureId: null });
    const response = await requestTransaction(fixture.rawToken, fixture.transaction.id);
    const json = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(json.transaction.status, "COMPLETED");
    assert.strictEqual(Object.hasOwn(json.transaction, "providerCaptureId"), false);
  });

  it("does not present an uncertain attempt as completed or expose its capture reference", async () => {
    const fixture = await createTransactionFixture({
      status: TransactionStatus.STATUS_UNKNOWN,
      attemptStatus: PaymentAttemptStatus.STATUS_UNKNOWN,
      providerCaptureId: `UNCONFIRMED_CAPTURE_${randomUUID()}`,
    });
    const response = await requestTransaction(fixture.rawToken, fixture.transaction.id);
    const json = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(json.transaction.status, "STATUS_UNKNOWN");
    assert.strictEqual(Object.hasOwn(json.transaction, "completedAt"), false);
    assert.strictEqual(Object.hasOwn(json.transaction, "providerCaptureId"), false);
  });

  it("returns not found for unknown and other-session transactions", async () => {
    const fixture = await createTransactionFixture();
    const otherSession = await createDemoSession();

    const inaccessible = await requestTransaction(otherSession.rawToken, fixture.transaction.id);
    const unknown = await requestTransaction(fixture.rawToken, "unknown-transaction-id");

    assert.strictEqual(inaccessible.status, 404);
    assert.strictEqual(unknown.status, 404);
    assert.strictEqual(Object.hasOwn(await inaccessible.json(), "transaction"), false);
    assert.strictEqual(Object.hasOwn(await unknown.json(), "transaction"), false);
  });
});

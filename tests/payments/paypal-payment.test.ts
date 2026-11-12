import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/db";
import { createDemoSession } from "@/lib/auth/session-service";
import { seedDemoMerchants } from "@/lib/merchants/merchant-service";
import { transactionService } from "@/lib/payments/transaction-service";
import { PayPalPaymentService } from "@/lib/payments/paypal-payment-service";
import {
  PayPalCaptureError,
  PayPalClient,
  PayPalOrderCreationError,
  PayPalOrderNotFoundError,
  type PayPalOrderResponse,
  type PayPalCaptureResponse,
  type PayPalOrderDetails,
} from "@/lib/paypal/paypal-client";
import { STALE_APPROVAL_AGE_MS } from "@/lib/payments/paypal-payment-service";
import { BankConnectionStatus, TransactionStatus, Prisma } from "@prisma/client";
import { ApiError } from "@/lib/errors/api-error";
import { POST as transactionsPostHandler, GET as transactionsGetHandler } from "@/app/api/transactions/route";
import { GET as transactionDetailGetHandler } from "@/app/api/transactions/[id]/route";
import { GET as resolveGetHandler } from "@/app/api/payments/paypal/resolve/route";
import { POST as cancelPostHandler } from "@/app/api/payments/paypal/cancel/route";

class MockPayPalClient extends PayPalClient {
  public tokenCalls = 0;
  public createOrderCalls = 0;
  public captureCalls = 0;
  public getOrderCalls = 0;
  public orderStatus = "APPROVED";
  public captureStatus = "COMPLETED";
  public lastCreateRequestId?: string;
  public lastCaptureRequestId?: string;
  public orderAmount = "25000";
  public orderCurrency = "JPY";
  public captureAmount = "25000";
  public captureCurrency = "JPY";
  public payeeEmail?: string;
  public omitCaptureId = false;
  public getOrderGate?: Promise<void>;
  public captureGate?: Promise<void>;
  public onGetOrder?: () => void;
  public onCapture?: () => void;
  public capturesList?: Array<{ id: string; status: string; amount: string; currency: string }>;
  public createOrderError?: Error;
  public getOrderError?: Error;

  override async getAccessToken(): Promise<string> {
    this.tokenCalls++;
    return "mock_access_token_123";
  }

  override async createOrder(
    params: { transactionId: string; amount: string; currency: string; description: string; customId?: string },
    requestId?: string
  ): Promise<PayPalOrderResponse> {
    this.createOrderCalls++;
    this.lastCreateRequestId = requestId;
    if (this.createOrderError) throw this.createOrderError;
    const orderId = `MOCK_ORDER_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return {
      id: orderId,
      status: "CREATED",
      approvalUrl: `https://www.sandbox.paypal.com/checkoutnow?token=${orderId}`,
    };
  }

  override async getOrder(orderId: string): Promise<PayPalOrderDetails> {
    this.getOrderCalls++;
    this.onGetOrder?.();
    if (this.getOrderError) throw this.getOrderError;
    await this.getOrderGate;
    return {
      id: orderId,
      status: this.orderStatus,
      amount: this.orderAmount,
      currency: this.orderCurrency,
      payeeEmail: this.payeeEmail,
      captures: this.capturesList,
    };
  }

  override async captureOrder(orderId: string, requestId?: string): Promise<PayPalCaptureResponse> {
    this.captureCalls++;
    this.lastCaptureRequestId = requestId;
    this.onCapture?.();
    await this.captureGate;
    const captureId = `MOCK_CAPTURE_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return {
      captureId: this.omitCaptureId ? undefined : captureId,
      status: this.captureStatus,
      amount: this.captureAmount,
      currency: this.captureCurrency,
      payeeEmail: this.payeeEmail,
    };
  }
}

describe("Phase 6: PayPal Sandbox Payment Lifecycle", () => {
  let mockClient: MockPayPalClient;
  let paymentService: PayPalPaymentService;

  before(async () => {
    await seedDemoMerchants();
  });

  beforeEach(() => {
    process.env.PAYPAL_PAYEE_EMAIL = "platform-merchant@globalpay.test";
    mockClient = new MockPayPalClient();
    mockClient.payeeEmail = process.env.PAYPAL_PAYEE_EMAIL;
    paymentService = new PayPalPaymentService(mockClient);
  });

  async function setupSessionWithBank(status: BankConnectionStatus = BankConnectionStatus.LINKED) {
    const { session, rawToken } = await createDemoSession();
    await db.bankConnection.upsert({
      where: { sessionId: session.id },
      create: {
        sessionId: session.id,
        status,
        institutionName: "JPMorgan Chase Demo",
        maskedAccountNumber: "•• 4821",
        isSimulated: true,
      },
      update: { status },
    });
    return { session, rawToken };
  }

  // 1. Payment eligibility guard on transaction creation
  it("1. rejects transaction creation when bank account is not linked", async () => {
    const { session } = await setupSessionWithBank(BankConnectionStatus.NOT_LINKED);

    await assert.rejects(
      async () => {
        await transactionService.createTransaction(session.id, {
          merchantId: "tokyo-metropolitan-hotel",
          amount: "25000",
          currency: "JPY",
        });
      },
      (err: unknown) => err instanceof ApiError && err.code === "BANK_LINKING_REQUIRED"
    );
  });

  // 2. Merchant active status check
  it("2. rejects transaction for non-existent merchant", async () => {
    const { session } = await setupSessionWithBank(BankConnectionStatus.LINKED);

    await assert.rejects(
      async () => {
        await transactionService.createTransaction(session.id, {
          merchantId: "non-existent-merchant",
          amount: "25000",
          currency: "JPY",
        });
      },
      (err: unknown) => err instanceof ApiError && err.statusCode === 404
    );
  });

  it("rejects a client amount that differs from the server-configured demo price", async () => {
    const { session } = await setupSessionWithBank();

    await assert.rejects(
      async () => {
        await transactionService.createTransaction(session.id, {
          merchantId: "kyoto-ryokan-stay",
          amount: "25001",
          currency: "JPY",
        });
      },
      (err: unknown) => err instanceof ApiError && err.code === "INVALID_AMOUNT"
    );
  });

  // 3. Currency mismatch rejection
  it("3. rejects transaction when currency does not match merchant currency", async () => {
    const { session } = await setupSessionWithBank(BankConnectionStatus.LINKED);

    await assert.rejects(
      async () => {
        await transactionService.createTransaction(session.id, {
          merchantId: "kyoto-ryokan-stay", // JPY
          amount: "100.00",
          currency: "USD",
        });
      },
      (err: unknown) => err instanceof ApiError && err.code === "UNSUPPORTED_CURRENCY"
    );
  });

  // 4. Currency precision rules (JPY cannot have decimal fraction)
  it("4. rejects fractional decimal amounts for JPY transactions", async () => {
    const { session } = await setupSessionWithBank(BankConnectionStatus.LINKED);

    await assert.rejects(
      async () => {
        await transactionService.createTransaction(session.id, {
          merchantId: "kyoto-ryokan-stay",
          amount: "25000.00", // JPY has 0 decimals
          currency: "JPY",
        });
      },
      (err: unknown) => err instanceof ApiError && err.code === "INVALID_AMOUNT"
    );
  });

  // 5. Successful transaction creation with FX snapshot
  it("5. creates transaction with accurate unrounded FX rate snapshot", async () => {
    const { session } = await setupSessionWithBank(BankConnectionStatus.LINKED);

    // Create a mock CurrencyQuote snapshot in DB with full Decimal(24,12)
    const quote = await db.currencyQuote.create({
      data: {
        baseAmount: new Prisma.Decimal("25000"),
        baseCurrency: "JPY",
        convertedAmount: new Prisma.Decimal("13695.52"),
        quoteCurrency: "INR",
        rate: new Prisma.Decimal("0.547820823244"),
        source: "frankfurter/ecb",
        asOf: new Date("2026-11-08T00:00:00.000Z"),
        isIndicative: true,
      },
    });

    const txn = await transactionService.createTransaction(session.id, {
      merchantId: "kyoto-ryokan-stay",
      amount: "25000",
      currency: "JPY",
      quoteId: quote.id,
    });

    assert.strictEqual(txn.status, TransactionStatus.CREATED);
    assert.strictEqual(txn.amount, "25000");
    assert.strictEqual(txn.currency, "JPY");
    assert.ok(txn.indicativeEstimate);
    assert.strictEqual(txn.indicativeEstimate?.homeCurrency, "INR");
    assert.strictEqual(txn.indicativeEstimate?.estimatedHomeAmount, "13695.52");
    assert.strictEqual(txn.indicativeEstimate?.rate, "0.547820823244");
  });

  // 6. Cross-session transaction isolation
  it("6. rejects cross-session access with 404 NOT_FOUND", async () => {
    const { session: sessionA } = await setupSessionWithBank();
    const { session: sessionB } = await setupSessionWithBank();

    const txn = await transactionService.createTransaction(sessionA.id, {
      merchantId: "kyoto-ryokan-stay",
      amount: "25000",
      currency: "JPY",
    });

    await assert.rejects(
      async () => {
        await transactionService.getTransaction(sessionB.id, txn.id);
      },
      (err: unknown) => err instanceof ApiError && err.statusCode === 404
    );
  });

  // 7. PayPal Order Creation
  it("7. creates a PayPal Sandbox order and transitions state to AWAITING_APPROVAL", async () => {
    const { session } = await setupSessionWithBank();
    const txn = await transactionService.createTransaction(session.id, {
      merchantId: "kyoto-ryokan-stay",
      amount: "25000",
      currency: "JPY",
    });

    const result = await paymentService.createPayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: `create_${txn.id}_key1`,
    });

    assert.strictEqual(result.transactionId, txn.id);
    assert.ok(result.providerOrderId.startsWith("MOCK_ORDER_"));
    assert.strictEqual(result.status, "AWAITING_APPROVAL");
    assert.strictEqual(mockClient.createOrderCalls, 1);

    // Verify DB update
    const updatedTxn = await db.transaction.findUnique({ where: { id: txn.id } });
    assert.strictEqual(updatedTxn?.status, TransactionStatus.AWAITING_APPROVAL);
  });

  it("rejects PayPal order creation if bank eligibility is lost after transaction creation", async () => {
    const { session } = await setupSessionWithBank();
    const txn = await transactionService.createTransaction(session.id, {
      merchantId: "kyoto-ryokan-stay",
      amount: "25000",
      currency: "JPY",
    });
    await db.bankConnection.update({
      where: { sessionId: session.id },
      data: { status: BankConnectionStatus.NOT_LINKED },
    });

    await assert.rejects(
      () =>
        paymentService.createPayPalOrder(session.id, {
          transactionId: txn.id,
          idempotencyKey: `ineligible_${txn.id}`,
        }),
      (err: unknown) => err instanceof ApiError && err.code === "BANK_LINKING_REQUIRED"
    );
    assert.strictEqual(mockClient.createOrderCalls, 0);
  });

  // 8. Idempotent PayPal Order Creation replay
  it("8. replays order creation idempotently without duplicate PayPal API calls", async () => {
    const { session } = await setupSessionWithBank();
    const txn = await transactionService.createTransaction(session.id, {
      merchantId: "kyoto-ryokan-stay",
      amount: "25000",
      currency: "JPY",
    });

    const key = `create_${txn.id}_idempotent`;
    const res1 = await paymentService.createPayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: key,
    });
    assert.strictEqual(mockClient.createOrderCalls, 1);

    const res2 = await paymentService.createPayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: key,
    });
    assert.strictEqual(mockClient.createOrderCalls, 1); // No new call!
    assert.strictEqual(res2.providerOrderId, res1.providerOrderId);
  });

  // 9. Idempotency key conflict rejection
  it("9. rejects idempotency key reuse with different request payload with 409", async () => {
    const { session } = await setupSessionWithBank();
    const txn1 = await transactionService.createTransaction(session.id, {
      merchantId: "kyoto-ryokan-stay",
      amount: "25000",
      currency: "JPY",
    });
    const txn2 = await transactionService.createTransaction(session.id, {
      merchantId: "kyoto-ryokan-stay",
      amount: "25000",
      currency: "JPY",
    });

    const sharedKey = `reused_key_${Date.now()}`;
    await paymentService.createPayPalOrder(session.id, {
      transactionId: txn1.id,
      idempotencyKey: sharedKey,
    });

    await assert.rejects(
      async () => {
        await paymentService.createPayPalOrder(session.id, {
          transactionId: txn2.id,
          idempotencyKey: sharedKey,
        });
      },
      (err: unknown) => err instanceof ApiError && err.code === "IDEMPOTENCY_CONFLICT"
    );
  });

  // 10. Order capture fails if PayPal order is not APPROVED
  it("10. rejects capture if PayPal order status is not APPROVED", async () => {
    const { session } = await setupSessionWithBank();
    const txn = await transactionService.createTransaction(session.id, {
      merchantId: "kyoto-ryokan-stay",
      amount: "25000",
      currency: "JPY",
    });
    await paymentService.createPayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: `create_${txn.id}`,
    });

    mockClient.orderStatus = "CREATED"; // Buyer hasn't approved yet!

    await assert.rejects(
      async () => {
        await paymentService.capturePayPalOrder(session.id, {
          transactionId: txn.id,
          idempotencyKey: `capture_${txn.id}`,
        });
      },
      (err: unknown) => err instanceof ApiError && err.code === "ORDER_NOT_APPROVED"
    );
  });

  // 11. Successful authoritative capture
  it("11. captures approved order and transitions state to COMPLETED with captureId", async () => {
    const { session } = await setupSessionWithBank();
    const txn = await transactionService.createTransaction(session.id, {
      merchantId: "kyoto-ryokan-stay",
      amount: "25000",
      currency: "JPY",
    });
    await paymentService.createPayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: `create_${txn.id}`,
    });

    mockClient.orderStatus = "APPROVED";

    const captureResult = await paymentService.capturePayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: `capture_${txn.id}`,
    });

    assert.strictEqual(captureResult.status, "COMPLETED");
    assert.ok(captureResult.providerCaptureId?.startsWith("MOCK_CAPTURE_"));
    assert.strictEqual(mockClient.captureCalls, 1);

    const completedTxn = await db.transaction.findUnique({ where: { id: txn.id } });
    assert.strictEqual(completedTxn?.status, TransactionStatus.COMPLETED);
    assert.ok(completedTxn?.completedAt);
  });

  // 12. Idempotent Capture replay
  it("12. replays capture idempotently without re-invoking PayPal capture", async () => {
    const { session } = await setupSessionWithBank();
    const txn = await transactionService.createTransaction(session.id, {
      merchantId: "kyoto-ryokan-stay",
      amount: "25000",
      currency: "JPY",
    });
    await paymentService.createPayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: `create_${txn.id}`,
    });

    mockClient.orderStatus = "APPROVED";
    const key = `capture_idempotent_${txn.id}`;

    const res1 = await paymentService.capturePayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: key,
    });
    assert.strictEqual(mockClient.captureCalls, 1);

    const res2 = await paymentService.capturePayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: key,
    });
    assert.strictEqual(mockClient.captureCalls, 1); // Not called again!
    assert.strictEqual(res2.status, "COMPLETED");
    assert.strictEqual(res2.providerCaptureId, res1.providerCaptureId);
  });

  // 13. API Route POST /api/transactions
  it("13. POST /api/transactions creates transaction and returns 201", async () => {
    const { rawToken } = await setupSessionWithBank();
    const request = new Request("http://localhost:3000/api/transactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `gp_session=${rawToken}`,
        Origin: "http://localhost:3000",
      },
      body: JSON.stringify({
        merchantId: "kyoto-ryokan-stay",
        amount: "25000",
        currency: "JPY",
      }),
    });

    const response = await transactionsPostHandler(request);
    assert.strictEqual(response.status, 201);
    const json = await response.json();
    assert.ok(json.transaction.id);
    assert.strictEqual(json.transaction.amount, "25000");
  });

  // 14. API Route GET /api/transactions
  it("14. GET /api/transactions returns user's transaction list", async () => {
    const { session, rawToken } = await setupSessionWithBank();
    await transactionService.createTransaction(session.id, {
      merchantId: "kyoto-ryokan-stay",
      amount: "25000",
      currency: "JPY",
    });

    const request = new Request("http://localhost:3000/api/transactions", {
      headers: { Cookie: `gp_session=${rawToken}` },
    });

    const response = await transactionsGetHandler(request);
    assert.strictEqual(response.status, 200);
    const json = await response.json();
    assert.ok(Array.isArray(json.transactions));
    assert.ok(json.transactions.length >= 1);
  });

  // 15. API Route GET /api/transactions/[id]
  it("15. GET /api/transactions/[id] returns single transaction detail", async () => {
    const { session, rawToken } = await setupSessionWithBank();
    const txn = await transactionService.createTransaction(session.id, {
      merchantId: "kyoto-ryokan-stay",
      amount: "25000",
      currency: "JPY",
    });

    const request = new Request(`http://localhost:3000/api/transactions/${txn.id}`, {
      headers: { Cookie: `gp_session=${rawToken}` },
    });

    const response = await transactionDetailGetHandler(request, {
      params: Promise.resolve({ id: txn.id }),
    });
    assert.strictEqual(response.status, 200);
    const json = await response.json();
    assert.strictEqual(json.transaction.id, txn.id);
  });

  // ===========================================================================
  // Phase 6 Remediation Tests
  // ===========================================================================

  // 16. SEC-01 & SEC-05: PayPal captures successfully but HTTP response is lost, retry recovers safely
  it("16. retry of STATUS_UNKNOWN captures safely and recovers already completed PayPal order", async () => {
    const { session } = await setupSessionWithBank();
    const txn = await transactionService.createTransaction(session.id, {
      merchantId: "kyoto-ryokan-stay",
      amount: "25000",
      currency: "JPY",
    });

    await paymentService.createPayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: "test_create_idem_retry",
    });

    // Simulate network drop during capture -> attempt marked STATUS_UNKNOWN
    mockClient.captureOrder = async (_orderId: string, requestId?: string) => {
      mockClient.captureCalls++;
      mockClient.lastCaptureRequestId = requestId;
      throw new Error("ETIMEDOUT");
    };

    const uncertainResult = await paymentService.capturePayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: "test_cap_retry_1",
    });
    assert.strictEqual(uncertainResult.status, "STATUS_UNKNOWN");

    // Verify DB state is STATUS_UNKNOWN with reconciliationNeeded: true
    const attemptAfterTimeout = await db.paymentAttempt.findFirst({
      where: { transactionId: txn.id },
    });
    assert.strictEqual(attemptAfterTimeout?.status, "STATUS_UNKNOWN");
    assert.strictEqual(attemptAfterTimeout?.reconciliationNeeded, true);

    // Now user retries: PayPal inquiry reveals order was completed and captures are available
    mockClient.orderStatus = "COMPLETED";
    const recoveredCaptureId = `MOCK_RECOVERED_CAPTURE_${txn.id}`;
    mockClient.capturesList = [{
      id: recoveredCaptureId,
      status: "COMPLETED",
      amount: "25000",
      currency: "JPY",
    }];

    const recoveredResult = await paymentService.capturePayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: "test_cap_retry_2",
    });

    assert.strictEqual(recoveredResult.status, "COMPLETED");
    assert.strictEqual(recoveredResult.providerCaptureId, recoveredCaptureId);
    assert.strictEqual(mockClient.captureCalls, 1);

    const txnFinal = await db.transaction.findUnique({ where: { id: txn.id } });
    assert.strictEqual(txnFinal?.status, TransactionStatus.COMPLETED);
    const attemptFinal = await db.paymentAttempt.findFirst({ where: { transactionId: txn.id } });
    assert.strictEqual(attemptFinal?.status, "COMPLETED");
    assert.strictEqual(attemptFinal?.reconciliationNeeded, false);
  });

  // 17. SEC-01: Retry discovers approved but uncaptured order and captures successfully
  it("17. retry discovers approved but uncaptured order in STATUS_UNKNOWN and captures successfully", async () => {
    const { session } = await setupSessionWithBank();
    const txn = await transactionService.createTransaction(session.id, {
      merchantId: "kyoto-ryokan-stay",
      amount: "25000",
      currency: "JPY",
    });

    await paymentService.createPayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: "test_create_idem_retry_app",
    });

    // Simulate timeout
    mockClient.captureOrder = async (_orderId: string, requestId?: string) => {
      mockClient.captureCalls++;
      mockClient.lastCaptureRequestId = requestId;
      throw new Error("ECONNRESET");
    };

    const uncertainResult = await paymentService.capturePayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: "test_cap_retry_app_1",
    });
    assert.strictEqual(uncertainResult.status, "STATUS_UNKNOWN");
    const firstCaptureRequestId = mockClient.lastCaptureRequestId;

    // Reset captureOrder to succeed; orderStatus is APPROVED
    mockClient.orderStatus = "APPROVED";
    mockClient.capturesList = undefined;
    const retriedCaptureId = `MOCK_RETRIED_CAPTURE_${txn.id}`;
    mockClient.captureOrder = async (orderId: string, reqId?: string) => {
      mockClient.captureCalls++;
      mockClient.lastCaptureRequestId = reqId;
      return {
        captureId: retriedCaptureId,
        status: "COMPLETED",
        amount: "25000",
        currency: "JPY",
        payeeEmail: mockClient.payeeEmail,
      };
    };

    const retryResult = await paymentService.capturePayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: "test_cap_retry_app_2",
    });

    assert.strictEqual(retryResult.status, "COMPLETED");
    assert.strictEqual(retryResult.providerCaptureId, retriedCaptureId);
    assert.strictEqual(mockClient.lastCaptureRequestId, firstCaptureRequestId);
    assert.strictEqual(mockClient.captureCalls, 2);
  });

  // 18. SEC-02: Mismatched capture amount
  it("18. rejects capture when capture response amount does not match transaction amount", async () => {
    const { session } = await setupSessionWithBank();
    const txn = await transactionService.createTransaction(session.id, {
      merchantId: "kyoto-ryokan-stay",
      amount: "25000",
      currency: "JPY",
    });

    await paymentService.createPayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: "test_create_mismatch_amt",
    });

    mockClient.captureAmount = "99999"; // Mismatched amount

    const result = await paymentService.capturePayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: "test_cap_mismatch_amt",
    });
    assert.strictEqual(result.status, "STATUS_UNKNOWN");
    const verificationEvent = await db.transactionEvent.findFirst({
      where: { transactionId: txn.id, eventType: "CAPTURE_VERIFICATION_UNCERTAIN" },
    });
    assert.ok(verificationEvent);
    assert.strictEqual((verificationEvent?.metadata as { reason?: string })?.reason, "CAPTURE_AMOUNT_MISMATCH");

    const txnAfter = await db.transaction.findUnique({ where: { id: txn.id } });
    assert.strictEqual(txnAfter?.status, TransactionStatus.STATUS_UNKNOWN);
    const attemptAfter = await db.paymentAttempt.findFirst({ where: { transactionId: txn.id } });
    assert.strictEqual(attemptAfter?.status, "STATUS_UNKNOWN");
    assert.strictEqual(attemptAfter?.providerCaptureId?.startsWith("MOCK_CAPTURE_"), true);
    assert.strictEqual(attemptAfter?.reconciliationNeeded, true);
  });

  // 19. SEC-02: Mismatched capture currency
  it("19. rejects capture when capture response currency does not match transaction currency", async () => {
    const { session } = await setupSessionWithBank();
    const txn = await transactionService.createTransaction(session.id, {
      merchantId: "kyoto-ryokan-stay",
      amount: "25000",
      currency: "JPY",
    });

    await paymentService.createPayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: "test_create_mismatch_curr",
    });

    mockClient.captureCurrency = "USD"; // Mismatched currency

    const result = await paymentService.capturePayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: "test_cap_mismatch_curr",
    });
    assert.strictEqual(result.status, "STATUS_UNKNOWN");
    const txnAfter = await db.transaction.findUnique({ where: { id: txn.id } });
    const attemptAfter = await db.paymentAttempt.findFirst({ where: { transactionId: txn.id } });
    assert.strictEqual(txnAfter?.status, TransactionStatus.STATUS_UNKNOWN);
    assert.strictEqual(attemptAfter?.status, "STATUS_UNKNOWN");
    assert.strictEqual(attemptAfter?.reconciliationNeeded, true);
  });

  // 20. SEC-03: Payee verification
  it("20. rejects order when payee email is mismatched against configured payee", async () => {
    const { session } = await setupSessionWithBank();
    const txn = await transactionService.createTransaction(session.id, {
      merchantId: "kyoto-ryokan-stay",
      amount: "25000",
      currency: "JPY",
    });

    await paymentService.createPayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: "test_create_payee_mismatch",
    });

    process.env.PAYPAL_PAYEE_EMAIL = "platform-merchant@globalpay.test";
    mockClient.payeeEmail = "attacker-account@evil.test";

    const result = await paymentService.capturePayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: "test_cap_payee_mismatch",
    });
    assert.strictEqual(result.status, "STATUS_UNKNOWN");
    assert.strictEqual(mockClient.captureCalls, 0);
    const attemptAfter = await db.paymentAttempt.findFirst({ where: { transactionId: txn.id } });
    assert.strictEqual(attemptAfter?.reconciliationNeeded, true);
  });

  // 21. SEC-04: Resolve API endpoint resolves order token to session-owned transaction
  it("21. GET /api/payments/paypal/resolve resolves order token to matching transaction", async () => {
    const { session, rawToken } = await setupSessionWithBank();
    const txn = await transactionService.createTransaction(session.id, {
      merchantId: "kyoto-ryokan-stay",
      amount: "25000",
      currency: "JPY",
    });

    const createRes = await paymentService.createPayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: "test_resolve_create",
    });

    const request = new Request(`http://localhost:3000/api/payments/paypal/resolve?token=${createRes.providerOrderId}`, {
      headers: { Cookie: `gp_session=${rawToken}` },
    });

    const response = await resolveGetHandler(request);
    assert.strictEqual(response.status, 200);
    const json = await response.json();
    assert.strictEqual(json.transactionId, txn.id);
    assert.strictEqual(json.status, TransactionStatus.AWAITING_APPROVAL);
    assert.strictEqual(Object.hasOwn(json, "token"), false);
    assert.strictEqual(Object.hasOwn(json, "amount"), false);
  });

  // 22. SEC-04: Resolve API rejects token belonging to another session
  it("22. GET /api/payments/paypal/resolve rejects token belonging to another session", async () => {
    const { session: sessionA } = await setupSessionWithBank();
    const { rawToken: rawTokenB } = await setupSessionWithBank();

    const txnA = await transactionService.createTransaction(sessionA.id, {
      merchantId: "kyoto-ryokan-stay",
      amount: "25000",
      currency: "JPY",
    });

    const createResA = await paymentService.createPayPalOrder(sessionA.id, {
      transactionId: txnA.id,
      idempotencyKey: "test_resolve_cross_session",
    });

    // Session B attempts to resolve Session A's order token
    const request = new Request(`http://localhost:3000/api/payments/paypal/resolve?token=${createResA.providerOrderId}`, {
      headers: { Cookie: `gp_session=${rawTokenB}` },
    });

    const response = await resolveGetHandler(request);
    assert.strictEqual(response.status, 404);
  });

  // 23. SEC-05: Stable PayPal-Request-Id derived from idempotency key
  it("23. derives and reuses stable PayPal-Request-Id for identical operations", async () => {
    const { session } = await setupSessionWithBank();
    const txn = await transactionService.createTransaction(session.id, {
      merchantId: "kyoto-ryokan-stay",
      amount: "25000",
      currency: "JPY",
    });

    await paymentService.createPayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: "stable_req_id_test_key",
    });

    const firstCreateReqId = mockClient.lastCreateRequestId;
    assert.ok(firstCreateReqId);
    assert.ok(firstCreateReqId.startsWith("gp_ord_"));

    await paymentService.capturePayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: "stable_req_id_cap_key",
    });

    const captureReqId = mockClient.lastCaptureRequestId;
    assert.ok(captureReqId);
    assert.ok(captureReqId.startsWith("gp_cap_"));
    assert.notStrictEqual(firstCreateReqId, captureReqId);
  });

  it("24. only one different-key request can capture an attempt already in flight", async () => {
    const { session } = await setupSessionWithBank();
    const txn = await transactionService.createTransaction(session.id, {
      merchantId: "kyoto-ryokan-stay",
      amount: "25000",
      currency: "JPY",
    });
    await paymentService.createPayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: "capture_pending_create",
    });

    let startCapture!: () => void;
    let releaseCapture!: () => void;
    const captureStarted = new Promise<void>((resolve) => {
      startCapture = resolve;
    });
    mockClient.captureGate = new Promise<void>((resolve) => {
      releaseCapture = resolve;
    });
    mockClient.onCapture = startCapture;

    const firstCapture = paymentService.capturePayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: "different_capture_key_one",
    });
    await captureStarted;

    try {
      const secondResult = await paymentService.capturePayPalOrder(session.id, {
        transactionId: txn.id,
        idempotencyKey: "different_capture_key_two",
      });
      assert.strictEqual(secondResult.status, "CAPTURE_PENDING");
      assert.strictEqual(mockClient.captureCalls, 1);
    } finally {
      releaseCapture();
    }

    const firstResult = await firstCapture;
    assert.strictEqual(firstResult.status, "COMPLETED");
    assert.strictEqual(mockClient.captureCalls, 1);
  });

  it("25. concurrent recovery requests acquire one lease and query PayPal once", async () => {
    const { session } = await setupSessionWithBank();
    const txn = await transactionService.createTransaction(session.id, {
      merchantId: "kyoto-ryokan-stay",
      amount: "25000",
      currency: "JPY",
    });
    await paymentService.createPayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: "recovery_lease_create",
    });
    await db.$transaction([
      db.paymentAttempt.updateMany({
        where: { transactionId: txn.id },
        data: { status: "STATUS_UNKNOWN", reconciliationNeeded: true },
      }),
      db.transaction.update({
        where: { id: txn.id },
        data: { status: TransactionStatus.STATUS_UNKNOWN },
      }),
    ]);

    let startInquiry!: () => void;
    let releaseInquiry!: () => void;
    const inquiryStarted = new Promise<void>((resolve) => {
      startInquiry = resolve;
    });
    mockClient.getOrderGate = new Promise<void>((resolve) => {
      releaseInquiry = resolve;
    });
    mockClient.onGetOrder = startInquiry;

    const firstRecovery = paymentService.capturePayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: "recovery_lease_key_one",
    });
    await inquiryStarted;

    try {
      const secondResult = await paymentService.capturePayPalOrder(session.id, {
        transactionId: txn.id,
        idempotencyKey: "recovery_lease_key_two",
      });
      assert.strictEqual(secondResult.status, "STATUS_UNKNOWN");
      assert.strictEqual(mockClient.getOrderCalls, 1);
      assert.strictEqual(mockClient.captureCalls, 0);
    } finally {
      releaseInquiry();
    }

    const recovered = await firstRecovery;
    assert.strictEqual(recovered.status, "COMPLETED");
    assert.strictEqual(mockClient.getOrderCalls, 1);
    assert.strictEqual(mockClient.captureCalls, 1);
  });

  it("26. missing capture ID is uncertain and cannot be retried as a fresh capture", async () => {
    const { session } = await setupSessionWithBank();
    const txn = await transactionService.createTransaction(session.id, {
      merchantId: "kyoto-ryokan-stay",
      amount: "25000",
      currency: "JPY",
    });
    await paymentService.createPayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: "missing_capture_id_create",
    });
    mockClient.omitCaptureId = true;

    const result = await paymentService.capturePayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: "missing_capture_id_capture",
    });
    assert.strictEqual(result.status, "STATUS_UNKNOWN");
    assert.strictEqual(result.providerCaptureId, undefined);
    assert.strictEqual(mockClient.captureCalls, 1);
    await assert.rejects(
      async () => paymentService.createPayPalOrder(session.id, {
        transactionId: txn.id,
        idempotencyKey: "missing_capture_id_new_order",
      }),
      (err: unknown) => err instanceof ApiError && err.code === "TRANSACTION_STATE_CONFLICT"
    );
    assert.strictEqual(mockClient.createOrderCalls, 1);

    mockClient.orderStatus = "COMPLETED";
    mockClient.capturesList = [{
      id: "",
      status: "COMPLETED",
      amount: "25000",
      currency: "JPY",
    }];
    const recovery = await paymentService.capturePayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: "missing_capture_id_recovery",
    });
    assert.strictEqual(recovery.status, "STATUS_UNKNOWN");
    assert.strictEqual(mockClient.captureCalls, 1);

    const transactionAfter = await db.transaction.findUnique({ where: { id: txn.id } });
    const attemptAfter = await db.paymentAttempt.findFirst({ where: { transactionId: txn.id } });
    assert.strictEqual(transactionAfter?.status, TransactionStatus.STATUS_UNKNOWN);
    assert.strictEqual(attemptAfter?.providerCaptureId, null);
    assert.strictEqual(attemptAfter?.reconciliationNeeded, true);
    assert.notStrictEqual(transactionAfter?.status, TransactionStatus.FAILED);
    assert.notStrictEqual(attemptAfter?.status, "DENIED");
  });

  it("27. unexpected capture status is recorded as uncertain, not denied", async () => {
    const { session } = await setupSessionWithBank();
    const txn = await transactionService.createTransaction(session.id, {
      merchantId: "kyoto-ryokan-stay",
      amount: "25000",
      currency: "JPY",
    });
    await paymentService.createPayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: "unexpected_capture_status_create",
    });
    mockClient.captureStatus = "PENDING";

    const result = await paymentService.capturePayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: "unexpected_capture_status_capture",
    });
    const transactionAfter = await db.transaction.findUnique({ where: { id: txn.id } });
    const attemptAfter = await db.paymentAttempt.findFirst({ where: { transactionId: txn.id } });
    assert.strictEqual(result.status, "STATUS_UNKNOWN");
    assert.strictEqual(transactionAfter?.status, TransactionStatus.STATUS_UNKNOWN);
    assert.strictEqual(attemptAfter?.status, "STATUS_UNKNOWN");
    assert.strictEqual(attemptAfter?.providerStatus, "PENDING");
    assert.strictEqual(attemptAfter?.reconciliationNeeded, true);
  });

  it("28. missing payee in order inquiry fails closed before dispatching capture", async () => {
    const { session } = await setupSessionWithBank();
    const txn = await transactionService.createTransaction(session.id, {
      merchantId: "kyoto-ryokan-stay",
      amount: "25000",
      currency: "JPY",
    });
    await paymentService.createPayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: "missing_order_payee_create",
    });
    mockClient.payeeEmail = undefined;

    const result = await paymentService.capturePayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: "missing_order_payee_capture",
    });
    assert.strictEqual(result.status, "STATUS_UNKNOWN");
    assert.strictEqual(mockClient.captureCalls, 0);
    const attemptAfter = await db.paymentAttempt.findFirst({ where: { transactionId: txn.id } });
    assert.strictEqual(attemptAfter?.reconciliationNeeded, true);
  });

  it("29. decimal-safe verification rejects a fractional mismatch below float precision", async () => {
    const { session } = await setupSessionWithBank();
    const txn = await transactionService.createTransaction(session.id, {
      merchantId: "kyoto-ryokan-stay",
      amount: "25000",
      currency: "JPY",
    });
    await paymentService.createPayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: "decimal_capture_create",
    });
    mockClient.captureAmount = "25000.000000000001";

    const result = await paymentService.capturePayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: "decimal_capture_verify",
    });
    const transactionAfter = await db.transaction.findUnique({ where: { id: txn.id } });
    assert.strictEqual(result.status, "STATUS_UNKNOWN");
    assert.strictEqual(transactionAfter?.status, TransactionStatus.STATUS_UNKNOWN);
  });
  // ---------------------------------------------------------------------------
  // Cancellation, abandonment and currency handling (payment-flow.md PF-02, PF-17)
  // ---------------------------------------------------------------------------

  async function createAwaitingOrder(key: string) {
    const setup = await setupSessionWithBank();
    const txn = await transactionService.createTransaction(setup.session.id, {
      merchantId: "kyoto-ryokan-stay",
      amount: "25000",
      currency: "JPY",
    });
    const order = await paymentService.createPayPalOrder(setup.session.id, {
      transactionId: txn.id,
      idempotencyKey: `${key}_${txn.id}`,
    });
    return { ...setup, txn, order };
  }

  it("30. cancel return marks an unapproved order CANCELLED only after PayPal verification", async () => {
    const { session, txn, order } = await createAwaitingOrder("cancel_verified");
    mockClient.orderStatus = "CREATED";

    const result = await paymentService.reconcileAwaitingApproval(session.id, {
      providerOrderId: order.providerOrderId,
      reason: "BUYER_RETURNED_TO_CANCEL_URL",
    });

    assert.strictEqual(result.outcome, "CANCELLED");
    assert.strictEqual(result.status, TransactionStatus.CANCELLED);
    assert.strictEqual(mockClient.getOrderCalls, 1);
    const stored = await db.transaction.findUnique({ where: { id: txn.id }, include: { paymentAttempts: true } });
    assert.strictEqual(stored?.status, TransactionStatus.CANCELLED);
    assert.strictEqual(stored?.failureCode, "BUYER_CANCELLED");
    assert.strictEqual(stored?.paymentAttempts[0].status, "CANCELLED");
    assert.strictEqual(stored?.paymentAttempts[0].captureLeaseToken, null);
    assert.strictEqual(stored?.completedAt, null);
  });

  it("31. a cancelled order can never be captured or re-ordered", async () => {
    const { session, txn, order } = await createAwaitingOrder("cancel_then_capture");
    mockClient.orderStatus = "CREATED";
    await paymentService.reconcileAwaitingApproval(session.id, {
      providerOrderId: order.providerOrderId,
      reason: "BUYER_RETURNED_TO_CANCEL_URL",
    });

    mockClient.orderStatus = "APPROVED";
    await assert.rejects(
      () => paymentService.capturePayPalOrder(session.id, { transactionId: txn.id, idempotencyKey: `cap_${txn.id}` }),
      (err: unknown) => err instanceof ApiError && err.code === "TRANSACTION_STATE_CONFLICT"
    );
    await assert.rejects(
      () => paymentService.createPayPalOrder(session.id, { transactionId: txn.id, idempotencyKey: `recreate_${txn.id}` }),
      (err: unknown) => err instanceof ApiError && err.code === "TRANSACTION_STATE_CONFLICT"
    );
    assert.strictEqual(mockClient.captureCalls, 0);
    assert.strictEqual(mockClient.createOrderCalls, 1);
  });

  it("32. cancel return leaves an APPROVED order untouched so capture still completes", async () => {
    const { session, txn, order } = await createAwaitingOrder("cancel_but_approved");
    mockClient.orderStatus = "APPROVED";

    const result = await paymentService.reconcileAwaitingApproval(session.id, {
      providerOrderId: order.providerOrderId,
      reason: "BUYER_RETURNED_TO_CANCEL_URL",
    });
    assert.strictEqual(result.outcome, "UNCHANGED");
    assert.strictEqual(result.status, TransactionStatus.AWAITING_APPROVAL);

    const capture = await paymentService.capturePayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: `cap_${txn.id}`,
    });
    assert.strictEqual(capture.status, "COMPLETED");
  });

  it("33. repeated cancel returns are idempotent and record one cancellation event", async () => {
    const { session, txn, order } = await createAwaitingOrder("cancel_repeat");
    mockClient.orderStatus = "CREATED";
    const params = { providerOrderId: order.providerOrderId, reason: "BUYER_RETURNED_TO_CANCEL_URL" as const };

    const first = await paymentService.reconcileAwaitingApproval(session.id, params);
    const second = await paymentService.reconcileAwaitingApproval(session.id, params);

    assert.strictEqual(first.outcome, "CANCELLED");
    assert.strictEqual(second.outcome, "UNCHANGED");
    assert.strictEqual(second.status, TransactionStatus.CANCELLED);
    assert.strictEqual(mockClient.getOrderCalls, 1);
    const events = await db.transactionEvent.count({ where: { transactionId: txn.id, eventType: "TRANSACTION_CANCELLED" } });
    assert.strictEqual(events, 1);
  });

  it("34. provider outage during cancel reconciliation leaves the transaction pending and releases the lease", async () => {
    const { session, txn, order } = await createAwaitingOrder("cancel_outage");
    mockClient.getOrderError = new Error("PAYPAL_TIMEOUT");

    const result = await paymentService.reconcileAwaitingApproval(session.id, {
      providerOrderId: order.providerOrderId,
      reason: "BUYER_RETURNED_TO_CANCEL_URL",
    });

    assert.strictEqual(result.outcome, "UNCHANGED");
    const stored = await db.transaction.findUnique({ where: { id: txn.id }, include: { paymentAttempts: true } });
    assert.strictEqual(stored?.status, TransactionStatus.AWAITING_APPROVAL);
    assert.strictEqual(stored?.paymentAttempts[0].captureLeaseToken, null);
  });

  it("35. stale sweep expires abandoned orders PayPal no longer has, but not recent or still-open ones", async () => {
    const { session } = await setupSessionWithBank();
    const makeOrder = async (ageMs: number) => {
      const txn = await transactionService.createTransaction(session.id, {
        merchantId: "kyoto-ryokan-stay",
        amount: "25000",
        currency: "JPY",
      });
      await paymentService.createPayPalOrder(session.id, { transactionId: txn.id, idempotencyKey: `sweep_${txn.id}` });
      await db.paymentAttempt.updateMany({
        where: { transactionId: txn.id },
        data: { createdAt: new Date(Date.now() - ageMs) },
      });
      return txn;
    };
    const abandoned = await makeOrder(STALE_APPROVAL_AGE_MS + 60_000);
    const recent = await makeOrder(5 * 60_000);

    mockClient.getOrderError = new PayPalOrderNotFoundError();
    const changed = await paymentService.reconcileStaleApprovals(session.id);

    assert.strictEqual(changed, 1);
    assert.strictEqual(mockClient.getOrderCalls, 1, "recent attempts are not queried by the sweep");
    const abandonedRow = await db.transaction.findUnique({ where: { id: abandoned.id } });
    const recentRow = await db.transaction.findUnique({ where: { id: recent.id } });
    assert.strictEqual(abandonedRow?.status, TransactionStatus.CANCELLED);
    assert.strictEqual(abandonedRow?.failureCode, "PAYPAL_ORDER_EXPIRED");
    assert.strictEqual(recentRow?.status, TransactionStatus.AWAITING_APPROVAL);

    // A stale order PayPal still reports as CREATED is left alone (buyer may still approve).
    const stillOpen = await makeOrder(STALE_APPROVAL_AGE_MS + 60_000);
    mockClient.getOrderError = undefined;
    mockClient.orderStatus = "CREATED";
    await paymentService.reconcileStaleApprovals(session.id);
    const stillOpenRow = await db.transaction.findUnique({ where: { id: stillOpen.id } });
    assert.strictEqual(stillOpenRow?.status, TransactionStatus.AWAITING_APPROVAL);

    // ...and is not re-queried again within the recheck window.
    const callsBefore = mockClient.getOrderCalls;
    await paymentService.reconcileStaleApprovals(session.id);
    assert.strictEqual(mockClient.getOrderCalls, callsBefore);
  });

  it("36. PayPal EXPIRED and VOIDED orders map to CANCELLED and FAILED", async () => {
    const expired = await createAwaitingOrder("expired_state");
    mockClient.orderStatus = "EXPIRED";
    const expiredResult = await paymentService.reconcileAwaitingApproval(expired.session.id, {
      providerOrderId: expired.order.providerOrderId,
      reason: "STALE_APPROVAL_SWEEP",
    });
    assert.strictEqual(expiredResult.outcome, "EXPIRED");
    assert.strictEqual(expiredResult.status, TransactionStatus.CANCELLED);

    const voided = await createAwaitingOrder("voided_state");
    mockClient.orderStatus = "VOIDED";
    const voidedResult = await paymentService.reconcileAwaitingApproval(voided.session.id, {
      providerOrderId: voided.order.providerOrderId,
      reason: "STALE_APPROVAL_SWEEP",
    });
    assert.strictEqual(voidedResult.outcome, "FAILED");
    assert.strictEqual(voidedResult.status, TransactionStatus.FAILED);
  });

  it("37. POST /api/payments/paypal/cancel rejects another session's order token", async () => {
    const { order } = await createAwaitingOrder("cancel_cross_session");
    const { rawToken: otherToken } = await setupSessionWithBank();

    const response = await cancelPostHandler(
      new Request("http://localhost:3000/api/payments/paypal/cancel", {
        method: "POST",
        headers: {
          Cookie: `gp_session=${otherToken}`,
          Origin: "http://localhost:3000",
          Host: "localhost:3000",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: order.providerOrderId }),
      })
    );
    assert.strictEqual(response.status, 404);
    assert.strictEqual(mockClient.getOrderCalls, 0);
  });

  it("38. rejects a currency PayPal cannot accept before calling PayPal", async () => {
    const { session } = await setupSessionWithBank();
    const txn = await transactionService.createTransaction(session.id, {
      merchantId: "kyoto-ryokan-stay",
      amount: "25000",
      currency: "JPY",
    });
    await db.transaction.update({ where: { id: txn.id }, data: { currency: "INR" } });

    await assert.rejects(
      () => paymentService.createPayPalOrder(session.id, { transactionId: txn.id, idempotencyKey: `inr_${txn.id}` }),
      (err: unknown) =>
        err instanceof ApiError &&
        err.code === "UNSUPPORTED_CURRENCY" &&
        err.statusCode === 422 &&
        err.message.includes("INR") &&
        err.message.includes("USD")
    );
    assert.strictEqual(mockClient.createOrderCalls, 0);
  });

  it("39. maps PayPal CURRENCY_NOT_SUPPORTED to a clear 422 and records the attempt as failed", async () => {
    const { session } = await setupSessionWithBank();
    const txn = await transactionService.createTransaction(session.id, {
      merchantId: "kyoto-ryokan-stay",
      amount: "25000",
      currency: "JPY",
    });
    mockClient.createOrderError = new PayPalOrderCreationError(
      "PAYPAL_ORDER_CREATION_FAILED_422",
      "rejected",
      "CURRENCY_NOT_SUPPORTED"
    );

    await assert.rejects(
      () => paymentService.createPayPalOrder(session.id, { transactionId: txn.id, idempotencyKey: `cns_${txn.id}` }),
      (err: unknown) => err instanceof ApiError && err.code === "UNSUPPORTED_CURRENCY" && err.statusCode === 422
    );
    const attempt = await db.paymentAttempt.findFirst({ where: { transactionId: txn.id } });
    assert.strictEqual(attempt?.status, "FAILED");
    const stored = await db.transaction.findUnique({ where: { id: txn.id } });
    assert.strictEqual(stored?.amount.toString(), "25000");
    assert.strictEqual(stored?.currency, "JPY");
  });

  // ---------------------------------------------------------------------------
  // Automatic confirmation: post-capture order inquiry and definitive failures
  // ---------------------------------------------------------------------------

  /** Simulates PayPal's order record holding one capture in the given state. */
  function settleOrder(captureId: string, status: string) {
    mockClient.orderStatus = status === "PENDING" ? "APPROVED" : "COMPLETED";
    mockClient.capturesList = [{ id: captureId, status, amount: "25000", currency: "JPY" }];
  }

  it("40. capture response without payee (real PayPal shape) is proven COMPLETED by order inquiry in the same request", async () => {
    const { session, txn } = await createAwaitingOrder("no_payee_capture");
    const captureId = `REAL_SHAPE_CAPTURE_${txn.id}`;
    mockClient.captureOrder = async (_orderId: string, requestId?: string) => {
      mockClient.captureCalls++;
      mockClient.lastCaptureRequestId = requestId;
      settleOrder(captureId, "COMPLETED");
      return { captureId, status: "COMPLETED", amount: "25000", currency: "JPY" }; // no payee
    };

    const result = await paymentService.capturePayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: `capture_${txn.id}`,
    });

    assert.strictEqual(result.status, "COMPLETED");
    assert.strictEqual(result.providerCaptureId, captureId);
    assert.strictEqual(mockClient.captureCalls, 1);
    assert.strictEqual(mockClient.getOrderCalls, 2); // pre-capture check + post-capture proof
    const stored = await db.transaction.findUnique({ where: { id: txn.id }, include: { paymentAttempts: true } });
    assert.strictEqual(stored?.status, TransactionStatus.COMPLETED);
    assert.strictEqual(stored?.paymentAttempts[0].status, "COMPLETED");
    assert.strictEqual(stored?.paymentAttempts[0].reconciliationNeeded, false);
    assert.strictEqual(stored?.paymentAttempts[0].captureLeaseToken, null);
    const uncertain = await db.transactionEvent.count({
      where: { transactionId: txn.id, eventType: "CAPTURE_VERIFICATION_UNCERTAIN" },
    });
    assert.strictEqual(uncertain, 0);
    const completedEvent = await db.transactionEvent.findFirst({
      where: { transactionId: txn.id, eventType: "PAYPAL_CAPTURE_COMPLETED" },
    });
    assert.strictEqual((completedEvent?.metadata as { verifiedVia?: string })?.verifiedVia, "ORDER_INQUIRY");
  });

  it("41. capture timeout after PayPal already captured confirms COMPLETED without a second capture", async () => {
    const { session, txn } = await createAwaitingOrder("timeout_but_captured");
    const captureId = `TIMEOUT_CAPTURE_${txn.id}`;
    mockClient.captureOrder = async () => {
      mockClient.captureCalls++;
      settleOrder(captureId, "COMPLETED");
      throw new Error("PAYPAL_TIMEOUT");
    };

    const result = await paymentService.capturePayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: `capture_${txn.id}`,
    });
    assert.strictEqual(result.status, "COMPLETED");
    assert.strictEqual(result.providerCaptureId, captureId);
    assert.strictEqual(mockClient.captureCalls, 1);
  });

  it("42. capture timeout before PayPal reflects it stays uncertain (never FAILED) and the next check reconciles to COMPLETED", async () => {
    const { session, txn } = await createAwaitingOrder("timeout_then_reconcile");
    mockClient.captureOrder = async () => {
      mockClient.captureCalls++;
      throw new Error("PAYPAL_TIMEOUT");
    };
    const key = `capture_${txn.id}`;

    const first = await paymentService.capturePayPalOrder(session.id, { transactionId: txn.id, idempotencyKey: key });
    assert.strictEqual(first.status, "STATUS_UNKNOWN");
    const pending = await db.transaction.findUnique({ where: { id: txn.id } });
    assert.strictEqual(pending?.status, TransactionStatus.STATUS_UNKNOWN);

    // PayPal finishes processing; the return page's automatic poll reuses the same key.
    settleOrder(`LATE_CAPTURE_${txn.id}`, "COMPLETED");
    const second = await paymentService.capturePayPalOrder(session.id, { transactionId: txn.id, idempotencyKey: key });
    assert.strictEqual(second.status, "COMPLETED");
    assert.strictEqual(second.providerCaptureId, `LATE_CAPTURE_${txn.id}`);
    assert.strictEqual(mockClient.captureCalls, 1);

    // Further polls replay the stored result without touching PayPal.
    const getOrderCallsBefore = mockClient.getOrderCalls;
    const third = await paymentService.capturePayPalOrder(session.id, { transactionId: txn.id, idempotencyKey: key });
    assert.strictEqual(third.status, "COMPLETED");
    assert.strictEqual(mockClient.getOrderCalls, getOrderCallsBefore);
    assert.strictEqual(mockClient.captureCalls, 1);
  });

  it("43. PayPal PENDING capture stays uncertain and later reconciles when PayPal completes it", async () => {
    const { session, txn } = await createAwaitingOrder("pending_capture");
    const captureId = `PENDING_CAPTURE_${txn.id}`;
    mockClient.captureOrder = async () => {
      mockClient.captureCalls++;
      settleOrder(captureId, "PENDING");
      return { captureId, status: "PENDING", amount: "25000", currency: "JPY" };
    };
    const key = `capture_${txn.id}`;

    const first = await paymentService.capturePayPalOrder(session.id, { transactionId: txn.id, idempotencyKey: key });
    assert.strictEqual(first.status, "STATUS_UNKNOWN");
    const attemptPending = await db.paymentAttempt.findFirst({ where: { transactionId: txn.id } });
    assert.strictEqual(attemptPending?.status, "STATUS_UNKNOWN");

    settleOrder(captureId, "COMPLETED");
    const second = await paymentService.capturePayPalOrder(session.id, { transactionId: txn.id, idempotencyKey: key });
    assert.strictEqual(second.status, "COMPLETED");
    assert.strictEqual(second.providerCaptureId, captureId);
    assert.strictEqual(mockClient.captureCalls, 1);
  });

  it("44. PayPal DECLINED capture is recorded as FAILED and can never be re-captured", async () => {
    const { session, txn } = await createAwaitingOrder("declined_capture");
    const captureId = `DECLINED_CAPTURE_${txn.id}`;
    mockClient.captureOrder = async () => {
      mockClient.captureCalls++;
      settleOrder(captureId, "DECLINED");
      return { captureId, status: "DECLINED", amount: "25000", currency: "JPY" };
    };
    const key = `capture_${txn.id}`;

    const result = await paymentService.capturePayPalOrder(session.id, { transactionId: txn.id, idempotencyKey: key });
    assert.strictEqual(result.status, "FAILED");
    const stored = await db.transaction.findUnique({ where: { id: txn.id }, include: { paymentAttempts: true } });
    assert.strictEqual(stored?.status, TransactionStatus.FAILED);
    assert.strictEqual(stored?.failureCode, "CAPTURE_DECLINED");
    assert.strictEqual(stored?.completedAt, null);
    assert.strictEqual(stored?.paymentAttempts[0].status, "DENIED");
    assert.strictEqual(stored?.paymentAttempts[0].captureLeaseToken, null);

    await assert.rejects(
      () => paymentService.capturePayPalOrder(session.id, { transactionId: txn.id, idempotencyKey: key }),
      (err: unknown) => err instanceof ApiError && err.code === "TRANSACTION_STATE_CONFLICT"
    );
    assert.strictEqual(mockClient.captureCalls, 1);
  });

  it("45. recovery that finds a FAILED capture on PayPal records FAILED", async () => {
    const { session, txn } = await createAwaitingOrder("failed_recovery");
    mockClient.captureOrder = async () => {
      mockClient.captureCalls++;
      throw new Error("PAYPAL_TIMEOUT");
    };
    const key = `capture_${txn.id}`;
    const first = await paymentService.capturePayPalOrder(session.id, { transactionId: txn.id, idempotencyKey: key });
    assert.strictEqual(first.status, "STATUS_UNKNOWN");

    settleOrder(`FAILED_CAPTURE_${txn.id}`, "FAILED");
    const second = await paymentService.capturePayPalOrder(session.id, { transactionId: txn.id, idempotencyKey: key });
    assert.strictEqual(second.status, "FAILED");
    const stored = await db.transaction.findUnique({ where: { id: txn.id }, include: { paymentAttempts: true } });
    assert.strictEqual(stored?.status, TransactionStatus.FAILED);
    assert.strictEqual(stored?.paymentAttempts[0].status, "FAILED");
    assert.strictEqual(mockClient.captureCalls, 1);
  });

  it("46. a capture response naming a different payee fails closed without being recovered by inquiry", async () => {
    const { session, txn } = await createAwaitingOrder("conflicting_capture_payee");
    const captureId = `PAYEE_CONFLICT_${txn.id}`;
    mockClient.captureOrder = async () => {
      mockClient.captureCalls++;
      settleOrder(captureId, "COMPLETED");
      return { captureId, status: "COMPLETED", amount: "25000", currency: "JPY", payeeEmail: "attacker@evil.test" };
    };

    const result = await paymentService.capturePayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: `capture_${txn.id}`,
    });
    assert.strictEqual(result.status, "STATUS_UNKNOWN");
    assert.strictEqual(mockClient.getOrderCalls, 1); // only the pre-capture check
    const stored = await db.transaction.findUnique({ where: { id: txn.id } });
    assert.strictEqual(stored?.status, TransactionStatus.STATUS_UNKNOWN);
  });

  it("47. order inquiry showing a different capture ID than PayPal returned stays uncertain", async () => {
    const { session, txn } = await createAwaitingOrder("capture_id_mismatch");
    mockClient.captureOrder = async () => {
      mockClient.captureCalls++;
      settleOrder(`OTHER_CAPTURE_${txn.id}`, "COMPLETED");
      return { captureId: `RETURNED_CAPTURE_${txn.id}`, status: "COMPLETED", amount: "25000", currency: "JPY" };
    };

    const result = await paymentService.capturePayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: `capture_${txn.id}`,
    });
    assert.strictEqual(result.status, "STATUS_UNKNOWN");
    const stored = await db.transaction.findUnique({ where: { id: txn.id } });
    assert.notStrictEqual(stored?.status, TransactionStatus.COMPLETED);
  });

  it("48. concurrent same-key capture requests capture once and create no duplicate records", async () => {
    const { session, txn } = await createAwaitingOrder("duplicate_same_key");
    let startCapture!: () => void;
    let releaseCapture!: () => void;
    const captureStarted = new Promise<void>((resolve) => { startCapture = resolve; });
    mockClient.captureGate = new Promise<void>((resolve) => { releaseCapture = resolve; });
    mockClient.onCapture = startCapture;
    const key = `capture_${txn.id}`;

    const first = paymentService.capturePayPalOrder(session.id, { transactionId: txn.id, idempotencyKey: key });
    await captureStarted;
    let duplicate;
    try {
      // e.g. a Strict Mode re-run, a second tab, or an automatic poll
      duplicate = await paymentService.capturePayPalOrder(session.id, { transactionId: txn.id, idempotencyKey: key });
    } finally {
      releaseCapture();
    }
    assert.strictEqual(duplicate.status, "CAPTURE_PENDING");
    const firstResult = await first;
    assert.strictEqual(firstResult.status, "COMPLETED");

    // The next automatic poll sees the completed transaction.
    const poll = await paymentService.capturePayPalOrder(session.id, { transactionId: txn.id, idempotencyKey: key });
    assert.strictEqual(poll.status, "COMPLETED");
    assert.strictEqual(poll.providerCaptureId, firstResult.providerCaptureId);

    assert.strictEqual(mockClient.captureCalls, 1);
    assert.strictEqual(await db.transaction.count({ where: { demoSessionId: session.id } }), 1);
    assert.strictEqual(await db.paymentAttempt.count({ where: { transactionId: txn.id } }), 1);
    assert.strictEqual(
      await db.transactionEvent.count({ where: { transactionId: txn.id, eventType: "TRANSACTION_COMPLETED" } }),
      1
    );
  });

  it("49. a late cancel return never cancels a payment PayPal has captured", async () => {
    const { session, txn, order } = await createAwaitingOrder("cancel_after_capture");
    const captured = await paymentService.capturePayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: `capture_${txn.id}`,
    });
    assert.strictEqual(captured.status, "COMPLETED");

    mockClient.orderStatus = "CREATED";
    const result = await paymentService.reconcileAwaitingApproval(session.id, {
      providerOrderId: order.providerOrderId,
      reason: "BUYER_RETURNED_TO_CANCEL_URL",
    });
    assert.strictEqual(result.outcome, "UNCHANGED");
    const stored = await db.transaction.findUnique({ where: { id: txn.id } });
    assert.strictEqual(stored?.status, TransactionStatus.COMPLETED);
  });

  // ---------------------------------------------------------------------------
  // PayPal capture errors (HTTP 422 etc.): only confirmed declines become FAILED
  // ---------------------------------------------------------------------------

  function failCaptureWith(error: Error) {
    mockClient.captureOrder = async (_orderId: string, requestId?: string) => {
      mockClient.captureCalls++;
      mockClient.lastCaptureRequestId = requestId;
      throw error;
    };
  }
  const declined = () => new PayPalCaptureError(422, "UNPROCESSABLE_ENTITY", "INSTRUMENT_DECLINED");

  it("50. PayPal client keeps only the validated error name and issue code from a capture error", async () => {
    const originalFetch = globalThis.fetch;
    const originalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    const originalSecret = process.env.PAYPAL_CLIENT_SECRET;
    process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ||= "sandbox-client-id";
    process.env.PAYPAL_CLIENT_SECRET ||= "sandbox-client-secret";
    const client = new (class extends PayPalClient {
      override async getAccessToken() { return "token"; }
    })();
    const reply = (body: unknown) => {
      globalThis.fetch = (async () => new Response(JSON.stringify(body), { status: 422 })) as typeof fetch;
    };
    const captureError = async () => {
      try {
        await client.captureOrder("ORDER_1", "gp_cap_x");
      } catch (err) {
        return err;
      }
      assert.fail("captureOrder should throw");
    };

    try {
      reply({
        name: "UNPROCESSABLE_ENTITY",
        message: "The requested action could not be performed.",
        debug_id: "abc123",
        details: [{ issue: "INSTRUMENT_DECLINED", description: "secret-ish provider text" }],
      });
      const err = await captureError();
      assert.ok(err instanceof PayPalCaptureError);
      assert.strictEqual(err.httpStatus, 422);
      assert.strictEqual(err.errorName, "UNPROCESSABLE_ENTITY");
      assert.strictEqual(err.issue, "INSTRUMENT_DECLINED");
      assert.strictEqual(err.message, "PAYPAL_CAPTURE_FAILED_422");
      assert.ok(!JSON.stringify({ ...err, message: err.message }).includes("secret-ish"));

      // Malformed / unexpected shapes are dropped rather than trusted.
      reply({ name: "<script>", details: [{ issue: "not an issue code" }] });
      const malformed = await captureError();
      assert.ok(malformed instanceof PayPalCaptureError);
      assert.strictEqual(malformed.errorName, undefined);
      assert.strictEqual(malformed.issue, undefined);
    } finally {
      globalThis.fetch = originalFetch;
      if (originalClientId === undefined) delete process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
      else process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID = originalClientId;
      if (originalSecret === undefined) delete process.env.PAYPAL_CLIENT_SECRET;
      else process.env.PAYPAL_CLIENT_SECRET = originalSecret;
    }
  });

  it("51. definitive 422 INSTRUMENT_DECLINED with no capture on PayPal is recorded as FAILED", async () => {
    const { session, txn } = await createAwaitingOrder("instrument_declined");
    failCaptureWith(declined());
    const key = `capture_${txn.id}`;

    const result = await paymentService.capturePayPalOrder(session.id, { transactionId: txn.id, idempotencyKey: key });
    assert.strictEqual(result.status, "FAILED");
    assert.strictEqual(result.providerCaptureId, undefined);
    assert.strictEqual(Object.hasOwn(result, "issue"), false);
    assert.strictEqual(mockClient.getOrderCalls, 2); // pre-capture check + post-error confirmation

    const stored = await db.transaction.findUnique({ where: { id: txn.id }, include: { paymentAttempts: true } });
    assert.strictEqual(stored?.status, TransactionStatus.FAILED);
    assert.strictEqual(stored?.failureCode, "PAYPAL_INSTRUMENT_DECLINED");
    assert.strictEqual(stored?.completedAt, null);
    assert.strictEqual(stored?.paymentAttempts[0].status, "DENIED");
    assert.strictEqual(stored?.paymentAttempts[0].reconciliationNeeded, false);
    assert.strictEqual(stored?.paymentAttempts[0].captureLeaseToken, null);
    const event = await db.transactionEvent.findFirst({
      where: { transactionId: txn.id, eventType: "PAYPAL_CAPTURE_DECLINED" },
    });
    assert.strictEqual((event?.metadata as { providerIssue?: string })?.providerIssue, "INSTRUMENT_DECLINED");

    // Retrying (e.g. the return page polling) never re-captures a declined payment.
    await assert.rejects(
      () => paymentService.capturePayPalOrder(session.id, { transactionId: txn.id, idempotencyKey: key }),
      (err: unknown) => err instanceof ApiError && err.code === "TRANSACTION_STATE_CONFLICT"
    );
    assert.strictEqual(mockClient.captureCalls, 1);
  });

  it("52. ambiguous HTTP 422 responses stay STATUS_UNKNOWN", async () => {
    const ambiguous = [
      new PayPalCaptureError(422, "UNPROCESSABLE_ENTITY", "PAYER_ACTION_REQUIRED"),
      new PayPalCaptureError(422, "UNPROCESSABLE_ENTITY"), // no issue code
      new PayPalCaptureError(422, undefined, "INSTRUMENT_DECLINED"), // unexpected envelope
      new PayPalCaptureError(500, "INTERNAL_SERVER_ERROR", "INSTRUMENT_DECLINED"), // not a 422
    ];
    for (const [index, error] of ambiguous.entries()) {
      const { session, txn } = await createAwaitingOrder(`ambiguous_422_${index}`);
      failCaptureWith(error);
      const result = await paymentService.capturePayPalOrder(session.id, {
        transactionId: txn.id,
        idempotencyKey: `capture_${txn.id}`,
      });
      assert.strictEqual(result.status, "STATUS_UNKNOWN", `case ${index}`);
      const stored = await db.transaction.findUnique({ where: { id: txn.id }, include: { paymentAttempts: true } });
      assert.strictEqual(stored?.status, TransactionStatus.STATUS_UNKNOWN, `case ${index}`);
      assert.strictEqual(stored?.paymentAttempts[0].reconciliationNeeded, true, `case ${index}`);
    }
  });

  it("53. a decline is not trusted when PayPal's order record cannot be checked (timeout)", async () => {
    const { session, txn } = await createAwaitingOrder("decline_inquiry_timeout");
    mockClient.captureOrder = async () => {
      mockClient.captureCalls++;
      mockClient.getOrderError = new Error("PAYPAL_TIMEOUT"); // post-error inquiry times out
      throw declined();
    };

    const result = await paymentService.capturePayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: `capture_${txn.id}`,
    });
    assert.strictEqual(result.status, "STATUS_UNKNOWN");
    const stored = await db.transaction.findUnique({ where: { id: txn.id } });
    assert.strictEqual(stored?.status, TransactionStatus.STATUS_UNKNOWN);
    const event = await db.transactionEvent.findFirst({
      where: { transactionId: txn.id, eventType: "CAPTURE_VERIFICATION_UNCERTAIN" },
    });
    assert.strictEqual((event?.metadata as { reason?: string })?.reason, "CAPTURE_DECLINE_UNCONFIRMED");
  });

  it("54. a plain capture timeout is never mapped to FAILED", async () => {
    const { session, txn } = await createAwaitingOrder("plain_timeout");
    failCaptureWith(new Error("PAYPAL_TIMEOUT"));

    const result = await paymentService.capturePayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: `capture_${txn.id}`,
    });
    assert.strictEqual(result.status, "STATUS_UNKNOWN");
    const stored = await db.transaction.findUnique({ where: { id: txn.id } });
    assert.strictEqual(stored?.status, TransactionStatus.STATUS_UNKNOWN);
  });

  it("55. a decline-looking error is ignored when PayPal already holds a completed capture", async () => {
    const { session, txn } = await createAwaitingOrder("decline_but_captured");
    const captureId = `ALREADY_CAPTURED_${txn.id}`;
    mockClient.captureOrder = async () => {
      mockClient.captureCalls++;
      settleOrder(captureId, "COMPLETED");
      throw declined();
    };

    const result = await paymentService.capturePayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: `capture_${txn.id}`,
    });
    assert.strictEqual(result.status, "COMPLETED");
    assert.strictEqual(result.providerCaptureId, captureId);
    const stored = await db.transaction.findUnique({ where: { id: txn.id } });
    assert.strictEqual(stored?.status, TransactionStatus.COMPLETED);
  });

  it("56. 422 ORDER_ALREADY_CAPTURED reconciles the existing capture instead of failing", async () => {
    const { session, txn } = await createAwaitingOrder("order_already_captured");
    const captureId = `EXISTING_CAPTURE_${txn.id}`;
    mockClient.captureOrder = async () => {
      mockClient.captureCalls++;
      settleOrder(captureId, "COMPLETED");
      throw new PayPalCaptureError(422, "UNPROCESSABLE_ENTITY", "ORDER_ALREADY_CAPTURED");
    };

    const result = await paymentService.capturePayPalOrder(session.id, {
      transactionId: txn.id,
      idempotencyKey: `capture_${txn.id}`,
    });
    assert.strictEqual(result.status, "COMPLETED");
    assert.strictEqual(result.providerCaptureId, captureId);
    assert.strictEqual(mockClient.captureCalls, 1);
  });
});

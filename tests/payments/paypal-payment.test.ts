import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/db";
import { createDemoSession } from "@/lib/auth/session-service";
import { seedDemoMerchants } from "@/lib/merchants/merchant-service";
import { transactionService } from "@/lib/payments/transaction-service";
import { PayPalPaymentService } from "@/lib/payments/paypal-payment-service";
import { PayPalClient, type PayPalOrderResponse, type PayPalCaptureResponse, type PayPalOrderDetails } from "@/lib/paypal/paypal-client";
import { BankConnectionStatus, TransactionStatus, Prisma } from "@prisma/client";
import { ApiError } from "@/lib/errors/api-error";
import { POST as transactionsPostHandler, GET as transactionsGetHandler } from "@/app/api/transactions/route";
import { GET as transactionDetailGetHandler } from "@/app/api/transactions/[id]/route";
import { GET as resolveGetHandler } from "@/app/api/payments/paypal/resolve/route";

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
});

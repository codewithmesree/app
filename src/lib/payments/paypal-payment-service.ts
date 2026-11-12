// =============================================================================
// GlobalPay — PayPal Payment Orchestration Service
// =============================================================================
// PRD §7.3, api-contract.md §8, payment-flow.md §17.2:
// Server-only orchestration for PayPal Sandbox order creation and capture.
// Enforces session ownership, idempotency locking, amount/currency matching,
// and audit event trails.
// =============================================================================

import "server-only";
import { createHash, randomUUID } from "node:crypto";
import {
  IdempotencyOperationType,
  IdempotencyStatus,
  PaymentAttemptStatus,
  PaymentEnvironment,
  PaymentProvider,
  Prisma,
  TransactionStatus,
} from "@prisma/client";
import { db } from "../db";
import { ApiError } from "../errors/api-error";
import { logger } from "../logging/logger";
import {
  PayPalOrderCreationError,
  PayPalOrderNotFoundError,
  payPalClient,
  type PayPalClient,
  validatePayPalApprovalUrl,
} from "../paypal/paypal-client";
import { isPayPalSupportedCurrency, unsupportedCurrencyMessage } from "../paypal/paypal-currencies";
import { getPayPalConfig, PayPalConfigurationError } from "../paypal/paypal-config";
import { evaluatePaymentEligibility } from "./eligibility";

export interface CreatePaymentResult {
  transactionId: string;
  providerOrderId: string;
  status: string;
  approvalUrl: string;
}

export interface CapturePaymentResult {
  transactionId: string;
  status: "COMPLETED" | "CAPTURE_PENDING" | "STATUS_UNKNOWN";
  amount: string;
  currency: string;
  capturedAt?: string;
  providerCaptureId?: string;
}

export interface ReconcileApprovalResult {
  transactionId: string;
  merchantId: string;
  status: TransactionStatus;
  /** What this reconciliation did. UNCHANGED means the server state was left as-is. */
  outcome: "CANCELLED" | "EXPIRED" | "FAILED" | "UNCHANGED";
}

export type ReconcileApprovalReason = "BUYER_RETURNED_TO_CANCEL_URL" | "STALE_APPROVAL_SWEEP";

const CAPTURE_LEASE_MS = 30_000;
/** Unapproved PayPal orders are only treated as expired once they are at least this old. */
export const STALE_APPROVAL_AGE_MS = 3 * 60 * 60 * 1000;
/** Minimum gap between provider inquiries for the same stale attempt. */
const STALE_APPROVAL_RECHECK_MS = 10 * 60 * 1000;
const STALE_APPROVAL_SWEEP_LIMIT = 5;
/** PayPal order states that mean the buyer has not approved the order. */
const UNAPPROVED_ORDER_STATES = new Set(["CREATED", "SAVED", "PAYER_ACTION_REQUIRED"]);

function amountMatches(actual: string, expected: Prisma.Decimal): boolean {
  try {
    return new Prisma.Decimal(actual).equals(expected);
  } catch {
    return false;
  }
}

export class PayPalPaymentService {
  constructor(private client: PayPalClient = payPalClient) {}

  private hashKey(sessionId: string, opType: IdempotencyOperationType, rawKey: string): string {
    return createHash("sha256").update(`${sessionId}:${opType}:${rawKey}`).digest("hex");
  }

  private hashPayload(payload: unknown): string {
    return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  }

  private async persistUncertainCapture(params: {
    transaction: {
      id: string;
      amount: Prisma.Decimal;
      currency: string;
      status: TransactionStatus;
    };
    attempt: {
      id: string;
      status: PaymentAttemptStatus;
      providerCaptureId: string | null;
    };
    leaseToken: string;
    idempotencyOperationId: string;
    requestId?: string;
    reason: string;
    providerStatus?: string;
    providerAmount?: string;
    providerCurrency?: string;
    providerCaptureId?: string;
    payeeVerified: boolean;
  }): Promise<CapturePaymentResult> {
    const now = new Date();
    const providerCaptureId = params.providerCaptureId || params.attempt.providerCaptureId || undefined;
    const result: CapturePaymentResult = {
      transactionId: params.transaction.id,
      status: "STATUS_UNKNOWN",
      amount: params.transaction.amount.toString(),
      currency: params.transaction.currency,
      providerCaptureId,
    };
    const evidence = {
      reason: params.reason,
      providerStatus: params.providerStatus ?? null,
      providerAmount: params.providerAmount ?? null,
      providerCurrency: params.providerCurrency ?? null,
      providerCaptureId: params.providerCaptureId ?? null,
      payeeVerified: params.payeeVerified,
    };

    await db.$transaction([
      db.paymentAttempt.update({
        where: { id: params.attempt.id, captureLeaseToken: params.leaseToken },
        data: {
          providerCaptureId: params.providerCaptureId || undefined,
          providerStatus: params.providerStatus,
          status: PaymentAttemptStatus.STATUS_UNKNOWN,
          reconciliationNeeded: true,
          lastCheckedAt: now,
          captureLeaseToken: null,
          captureLeaseUntil: null,
          events: {
            create: {
              transactionId: params.transaction.id,
              eventType: "CAPTURE_VERIFICATION_UNCERTAIN",
              fromStatus: params.attempt.status,
              toStatus: PaymentAttemptStatus.STATUS_UNKNOWN,
              source: "PAYPAL_VERIFICATION",
              requestId: params.requestId || null,
              metadata: evidence,
            },
          },
        },
      }),
      db.transaction.update({
        where: { id: params.transaction.id },
        data: {
          status: TransactionStatus.STATUS_UNKNOWN,
          failureCode: "CAPTURE_VERIFICATION_UNCERTAIN",
          events: {
            create: {
              eventType: "TRANSACTION_REQUIRES_RECONCILIATION",
              fromStatus: params.transaction.status,
              toStatus: TransactionStatus.STATUS_UNKNOWN,
              source: "PAYPAL_VERIFICATION",
              requestId: params.requestId || null,
              metadata: evidence,
            },
          },
        },
      }),
      db.idempotencyOperation.update({
        where: { id: params.idempotencyOperationId },
        data: {
          status: IdempotencyStatus.UNKNOWN,
          safeResult: result as unknown as Prisma.InputJsonValue,
        },
      }),
    ]);

    logger.warn("PayPal capture requires reconciliation", {
      requestId: params.requestId,
      context: {
        transactionId: params.transaction.id,
        paymentAttemptId: params.attempt.id,
        reason: params.reason,
        providerStatus: params.providerStatus,
        providerCaptureId,
      },
    });

    return result;
  }

  private async persistCompletedCapture(params: {
    transaction: {
      id: string;
      amount: Prisma.Decimal;
      currency: string;
      status: TransactionStatus;
    };
    attempt: {
      id: string;
      status: PaymentAttemptStatus;
    };
    leaseToken: string;
    idempotencyOperationId: string;
    requestId?: string;
    captureId: string;
    recovered: boolean;
  }): Promise<CapturePaymentResult> {
    const now = new Date();
    const result: CapturePaymentResult = {
      transactionId: params.transaction.id,
      status: "COMPLETED",
      amount: params.transaction.amount.toString(),
      currency: params.transaction.currency,
      capturedAt: now.toISOString(),
      providerCaptureId: params.captureId,
    };
    const eventType = params.recovered ? "PAYPAL_CAPTURE_RECOVERED" : "PAYPAL_CAPTURE_COMPLETED";
    const metadata = { captureId: params.captureId, recovered: params.recovered };

    await db.$transaction([
      db.paymentAttempt.update({
        where: { id: params.attempt.id, captureLeaseToken: params.leaseToken },
        data: {
          providerCaptureId: params.captureId,
          providerStatus: "COMPLETED",
          status: PaymentAttemptStatus.COMPLETED,
          reconciliationNeeded: false,
          capturedAt: now,
          lastCheckedAt: now,
          captureLeaseToken: null,
          captureLeaseUntil: null,
          events: {
            create: {
              transactionId: params.transaction.id,
              eventType,
              fromStatus: params.attempt.status,
              toStatus: PaymentAttemptStatus.COMPLETED,
              source: "PAYPAL_API",
              requestId: params.requestId || null,
              metadata,
            },
          },
        },
      }),
      db.transaction.update({
        where: { id: params.transaction.id },
        data: {
          status: TransactionStatus.COMPLETED,
          completedAt: now,
          failureCode: null,
          events: {
            create: {
              eventType: "TRANSACTION_COMPLETED",
              fromStatus: params.transaction.status,
              toStatus: TransactionStatus.COMPLETED,
              source: "PAYPAL_API",
              requestId: params.requestId || null,
              metadata,
            },
          },
        },
      }),
      db.idempotencyOperation.update({
        where: { id: params.idempotencyOperationId },
        data: {
          status: IdempotencyStatus.SUCCEEDED,
          safeResult: result as unknown as Prisma.InputJsonValue,
        },
      }),
    ]);

    return result;
  }

  /**
   * Creates a PayPal v2 Sandbox order for an existing transaction.
   * Idempotent replay returns the existing approvalUrl and orderId.
   */
  async createPayPalOrder(
    sessionId: string,
    params: { transactionId: string; idempotencyKey: string },
    requestId?: string
  ): Promise<CreatePaymentResult> {
    const keyHash = this.hashKey(sessionId, IdempotencyOperationType.PAYPAL_CREATE, params.idempotencyKey);
    const fingerprint = this.hashPayload({ transactionId: params.transactionId });

    // 1. Check Idempotency Record
    const existingOp = await db.idempotencyOperation.findUnique({
      where: {
        demoSessionId_operationType_keyHash: {
          demoSessionId: sessionId,
          operationType: IdempotencyOperationType.PAYPAL_CREATE,
          keyHash,
        },
      },
    });

    if (existingOp) {
      if (existingOp.requestFingerprint !== fingerprint) {
        throw new ApiError({
          statusCode: 409,
          code: "IDEMPOTENCY_CONFLICT",
          message: "Idempotency key was previously used with a different request payload.",
        });
      }

      if (existingOp.status === IdempotencyStatus.SUCCEEDED && existingOp.safeResult) {
        return existingOp.safeResult as unknown as CreatePaymentResult;
      }

      if (existingOp.status === IdempotencyStatus.IN_PROGRESS) {
        throw new ApiError({
          statusCode: 409,
          code: "IDEMPOTENCY_CONFLICT",
          message: "An identical payment creation operation is currently in progress. Please retry shortly.",
        });
      }
    }

    // 2. Fetch Transaction and assert session ownership
    const transaction = await db.transaction.findUnique({
      where: { id: params.transactionId },
      include: { merchant: true, paymentAttempts: true },
    });

    if (!transaction || transaction.demoSessionId !== sessionId) {
      throw ApiError.notFound("The requested transaction was not found.");
    }

    if (transaction.status === TransactionStatus.COMPLETED) {
      throw new ApiError({
        statusCode: 409,
        code: "TRANSACTION_STATE_CONFLICT",
        message: "Transaction is already completed.",
      });
    }

    // CANCELLED and FAILED are terminal (payment-flow.md state diagram). A retry
    // must start a new transaction so history is never rewritten.
    if (
      transaction.status === TransactionStatus.CANCELLED ||
      transaction.status === TransactionStatus.FAILED
    ) {
      throw new ApiError({
        statusCode: 409,
        code: "TRANSACTION_STATE_CONFLICT",
        message: "This payment attempt has ended. Start a new payment to try again.",
      });
    }

    // PF-17: reject currencies PayPal cannot accept before any provider call.
    if (!isPayPalSupportedCurrency(transaction.currency)) {
      throw new ApiError({
        statusCode: 422,
        code: "UNSUPPORTED_CURRENCY",
        message: unsupportedCurrencyMessage(transaction.currency),
      });
    }

    const uncertainCreateAttempt = transaction.paymentAttempts.find(
      (attempt) =>
        attempt.status === PaymentAttemptStatus.STATUS_UNKNOWN &&
        !attempt.providerOrderId
    );
    const retryingUnknownCreate =
      existingOp?.status === IdempotencyStatus.UNKNOWN && uncertainCreateAttempt !== undefined;

    if (existingOp?.status === IdempotencyStatus.UNKNOWN && !retryingUnknownCreate) {
      throw new ApiError({
        statusCode: 409,
        code: "TRANSACTION_STATE_CONFLICT",
        message: "The uncertain PayPal order request cannot be reconciled automatically.",
      });
    }

    const unresolvedAttempt = transaction.paymentAttempts.find(
      (attempt) =>
        attempt.status === PaymentAttemptStatus.AWAITING_APPROVAL ||
        attempt.status === PaymentAttemptStatus.CAPTURE_PENDING ||
        attempt.status === PaymentAttemptStatus.STATUS_UNKNOWN
    );
    if (unresolvedAttempt && !retryingUnknownCreate) {
      throw new ApiError({
        statusCode: 409,
        code: "TRANSACTION_STATE_CONFLICT",
        message: "An existing PayPal attempt must be resolved before creating another order.",
      });
    }

    if (!retryingUnknownCreate) {
      const eligibility = await evaluatePaymentEligibility(sessionId);
      if (!eligibility.eligible) {
        throw ApiError.bankLinkingRequired(eligibility.explanation);
      }
    }

    // 3. Register Idempotency Operation as IN_PROGRESS
    const idempotencyOp = await db.idempotencyOperation.upsert({
      where: {
        demoSessionId_operationType_keyHash: {
          demoSessionId: sessionId,
          operationType: IdempotencyOperationType.PAYPAL_CREATE,
          keyHash,
        },
      },
      create: {
        demoSessionId: sessionId,
        transactionId: transaction.id,
        operationType: IdempotencyOperationType.PAYPAL_CREATE,
        keyHash,
        requestFingerprint: fingerprint,
        status: IdempotencyStatus.IN_PROGRESS,
      },
      update: {
        status: IdempotencyStatus.IN_PROGRESS,
        requestFingerprint: fingerprint,
      },
    });

    // 4. Create PaymentAttempt record in DB before network call
    const paymentAttempt =
      uncertainCreateAttempt && retryingUnknownCreate
        ? uncertainCreateAttempt
        : await db.paymentAttempt.create({
            data: {
              transactionId: transaction.id,
              provider: PaymentProvider.PAYPAL,
              environment: PaymentEnvironment.SANDBOX,
              amount: transaction.amount,
              currency: transaction.currency,
              status: PaymentAttemptStatus.CREATED,
            },
          });

    // 5. Invoke PayPal Sandbox API with stable provider idempotency ID
    const providerRequestId = `gp_ord_${idempotencyOp.keyHash.slice(0, 26)}`;
    let orderResult: { id: string; status: string; approvalUrl: string };
    try {
      orderResult = await this.client.createOrder({
        transactionId: transaction.id,
        amount: transaction.amount.toString(),
        currency: transaction.currency,
        description: `GlobalPay Demo Payment to ${transaction.merchant.name}`,
        customId: paymentAttempt.id,
      }, providerRequestId);
      if (orderResult.status !== "CREATED" || !orderResult.id) {
        throw new PayPalOrderCreationError("PAYPAL_INVALID_ORDER_RESPONSE", "unknown");
      }
      orderResult = {
        ...orderResult,
        approvalUrl: validatePayPalApprovalUrl(orderResult.approvalUrl),
      };
    } catch (error) {
      const configError =
        error instanceof PayPalConfigurationError ||
        (error instanceof Error && error.name === "PayPalConfigurationError");

      if (configError) {
        throw new ApiError({
          statusCode: 500,
          code: "PAYPAL_CONFIGURATION_ERROR",
          message:
            "PayPal sandbox configuration is invalid. Set the PayPal client ID, client secret, and payee email in the local environment before retrying.",
          cause: error,
        });
      }

      const outcomeUnknown =
        retryingUnknownCreate ||
        !(error instanceof PayPalOrderCreationError) ||
        error.outcome === "unknown";

      if (outcomeUnknown) {
        await db.$transaction([
          db.paymentAttempt.update({
            where: { id: paymentAttempt.id },
            data: {
              status: PaymentAttemptStatus.STATUS_UNKNOWN,
              failureCode: "PAYPAL_ORDER_OUTCOME_UNKNOWN",
              events: {
                create: {
                  transactionId: transaction.id,
                  eventType: "PAYPAL_ORDER_OUTCOME_UNKNOWN",
                  fromStatus: paymentAttempt.status,
                  toStatus: PaymentAttemptStatus.STATUS_UNKNOWN,
                  source: "PAYPAL_API",
                  requestId: requestId || null,
                },
              },
            },
          }),
          db.transaction.update({
            where: { id: transaction.id },
            data: {
              status: TransactionStatus.STATUS_UNKNOWN,
              events: {
                create: {
                  eventType: "TRANSACTION_STATUS_UNKNOWN",
                  fromStatus: transaction.status,
                  toStatus: TransactionStatus.STATUS_UNKNOWN,
                  source: "PAYPAL_API",
                  requestId: requestId || null,
                  metadata: { reason: "PAYPAL_ORDER_OUTCOME_UNKNOWN" },
                },
              },
            },
          }),
          db.idempotencyOperation.update({
            where: { id: idempotencyOp.id },
            data: { status: IdempotencyStatus.UNKNOWN },
          }),
        ]);
        throw new ApiError({
          statusCode: 504,
          code: "PAYMENT_STATUS_UNCONFIRMED",
          message:
            "PayPal did not confirm whether the order was created. Retry this same payment to reconcile its status.",
          cause: error,
        });
      }

      await db.$transaction([
        db.paymentAttempt.update({
          where: { id: paymentAttempt.id },
          data: {
            status: PaymentAttemptStatus.FAILED,
            failureCode: "PAYPAL_CREATION_FAILED",
            events: {
              create: {
                transactionId: transaction.id,
                eventType: "PAYPAL_ORDER_CREATION_FAILED",
                fromStatus: paymentAttempt.status,
                toStatus: PaymentAttemptStatus.FAILED,
                source: "PAYPAL_API",
                requestId: requestId || null,
              },
            },
          },
        }),
        db.idempotencyOperation.update({
          where: { id: idempotencyOp.id },
          data: { status: IdempotencyStatus.FAILED },
        }),
      ]);

      const issue = error instanceof PayPalOrderCreationError ? error.issue : undefined;
      if (issue === "CURRENCY_NOT_SUPPORTED") {
        throw new ApiError({
          statusCode: 422,
          code: "UNSUPPORTED_CURRENCY",
          message: unsupportedCurrencyMessage(transaction.currency),
          cause: error,
        });
      }
      throw new ApiError({
        statusCode: 502,
        code: "PAYPAL_PROVIDER_ERROR",
        message: "PayPal Sandbox rejected the order request. No payment was created. Please try again later.",
        cause: error,
      });
    }

    // 6. Update PaymentAttempt, Transaction, and Idempotency atomically
    const safeResult: CreatePaymentResult = {
      transactionId: transaction.id,
      providerOrderId: orderResult.id,
      status: "AWAITING_APPROVAL",
      approvalUrl: orderResult.approvalUrl,
    };

    await db.$transaction([
      db.paymentAttempt.update({
        where: { id: paymentAttempt.id },
        data: {
          providerOrderId: orderResult.id,
          status: PaymentAttemptStatus.AWAITING_APPROVAL,
          events: {
            create: {
              transactionId: transaction.id,
              eventType: "PAYPAL_ORDER_CREATED",
              fromStatus: "CREATED",
              toStatus: "AWAITING_APPROVAL",
              source: "PAYPAL_API",
              requestId: requestId || null,
              metadata: { providerOrderId: orderResult.id },
            },
          },
        },
      }),
      db.transaction.update({
        where: { id: transaction.id },
        data: {
          status: TransactionStatus.AWAITING_APPROVAL,
          events: {
            create: {
              eventType: "TRANSACTION_AWAITING_APPROVAL",
              fromStatus: TransactionStatus.CREATED,
              toStatus: TransactionStatus.AWAITING_APPROVAL,
              source: "PAYPAL_API",
              requestId: requestId || null,
              metadata: { providerOrderId: orderResult.id },
            },
          },
        },
      }),
      db.idempotencyOperation.update({
        where: { id: idempotencyOp.id },
        data: {
          status: IdempotencyStatus.SUCCEEDED,
          safeResult: safeResult as unknown as Prisma.InputJsonValue,
        },
      }),
    ]);

    return safeResult;
  }

  /**
   * Executes authoritative capture against PayPal Sandbox after buyer approval.
   */
  async capturePayPalOrder(
    sessionId: string,
    params: { transactionId: string; idempotencyKey: string },
    requestId?: string
  ): Promise<CapturePaymentResult> {
    const keyHash = this.hashKey(sessionId, IdempotencyOperationType.PAYPAL_CAPTURE, params.idempotencyKey);
    const fingerprint = this.hashPayload({ transactionId: params.transactionId });

    // 1. Idempotency Check
    const existingOp = await db.idempotencyOperation.findUnique({
      where: {
        demoSessionId_operationType_keyHash: {
          demoSessionId: sessionId,
          operationType: IdempotencyOperationType.PAYPAL_CAPTURE,
          keyHash,
        },
      },
    });

    if (existingOp) {
      if (existingOp.requestFingerprint !== fingerprint) {
        throw new ApiError({
          statusCode: 409,
          code: "IDEMPOTENCY_CONFLICT",
          message: "Idempotency key was previously used with a different capture payload.",
        });
      }

      if (existingOp.status === IdempotencyStatus.SUCCEEDED && existingOp.safeResult) {
        return existingOp.safeResult as unknown as CapturePaymentResult;
      }
    }

    // 2. Fetch Transaction and assert session ownership
    const transaction = await db.transaction.findUnique({
      where: { id: params.transactionId },
      include: {
        merchant: true,
        paymentAttempts: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!transaction || transaction.demoSessionId !== sessionId) {
      throw ApiError.notFound("The requested transaction was not found.");
    }

    if (transaction.status === TransactionStatus.COMPLETED) {
      const successfulAttempt = transaction.paymentAttempts.find((a) => a.status === PaymentAttemptStatus.COMPLETED);
      return {
        transactionId: transaction.id,
        status: "COMPLETED",
        amount: transaction.amount.toString(),
        currency: transaction.currency,
        capturedAt: transaction.completedAt?.toISOString() || transaction.updatedAt.toISOString(),
        providerCaptureId: successfulAttempt?.providerCaptureId || undefined,
      };
    }

    const activeAttempt = transaction.paymentAttempts.find(
      (a) =>
        (a.status === PaymentAttemptStatus.AWAITING_APPROVAL ||
          a.status === PaymentAttemptStatus.CAPTURE_PENDING ||
          a.status === PaymentAttemptStatus.STATUS_UNKNOWN) &&
        a.providerOrderId
    );

    if (!activeAttempt || !activeAttempt.providerOrderId) {
      throw new ApiError({
        statusCode: 409,
        code: "TRANSACTION_STATE_CONFLICT",
        message: "No active PayPal order is awaiting approval or recovery for this transaction.",
      });
    }

    const config = getPayPalConfig();
    const idempotencyOp = await db.idempotencyOperation.upsert({
      where: {
        demoSessionId_operationType_keyHash: {
          demoSessionId: sessionId,
          operationType: IdempotencyOperationType.PAYPAL_CAPTURE,
          keyHash,
        },
      },
      create: {
        demoSessionId: sessionId,
        transactionId: transaction.id,
        paymentAttemptId: activeAttempt.id,
        operationType: IdempotencyOperationType.PAYPAL_CAPTURE,
        keyHash,
        requestFingerprint: fingerprint,
        status: IdempotencyStatus.IN_PROGRESS,
      },
      update: {
        status: IdempotencyStatus.IN_PROGRESS,
      },
    });
    const now = new Date();
    const leaseToken = randomUUID();
    const leaseUntil = new Date(now.getTime() + CAPTURE_LEASE_MS);
    const leaseAvailable = {
      OR: [{ captureLeaseUntil: null }, { captureLeaseUntil: { lte: now } }],
    };
    let claimed = false;
    let recovering = false;

    if (activeAttempt.status === PaymentAttemptStatus.AWAITING_APPROVAL) {
      claimed = await db.$transaction(async (tx) => {
        const attemptLock = await tx.paymentAttempt.updateMany({
          where: {
            id: activeAttempt.id,
            status: PaymentAttemptStatus.AWAITING_APPROVAL,
            ...leaseAvailable,
          },
          data: {
            status: PaymentAttemptStatus.CAPTURE_PENDING,
            captureRequestedAt: now,
            captureLeaseToken: leaseToken,
            captureLeaseUntil: leaseUntil,
          },
        });
        if (attemptLock.count !== 1) return false;

        const transactionLock = await tx.transaction.updateMany({
          where: {
            id: transaction.id,
            status: TransactionStatus.AWAITING_APPROVAL,
          },
          data: { status: TransactionStatus.CAPTURE_PENDING },
        });
        if (transactionLock.count !== 1) {
          throw new Error("PAYMENT_STATE_CHANGED_DURING_CAPTURE_ACQUISITION");
        }
        return true;
      });
    } else if (activeAttempt.status === PaymentAttemptStatus.STATUS_UNKNOWN) {
      recovering = true;
      const recoveryClaim = await db.paymentAttempt.updateMany({
        where: {
          id: activeAttempt.id,
          status: PaymentAttemptStatus.STATUS_UNKNOWN,
          ...leaseAvailable,
        },
        data: {
          captureLeaseToken: leaseToken,
          captureLeaseUntil: leaseUntil,
          lastCheckedAt: now,
        },
      });
      claimed = recoveryClaim.count === 1;
    } else if (activeAttempt.status === PaymentAttemptStatus.CAPTURE_PENDING) {
      const staleBefore = new Date(now.getTime() - CAPTURE_LEASE_MS);
      const captureIsStale =
        activeAttempt.captureRequestedAt !== null &&
        activeAttempt.captureRequestedAt <= staleBefore;
      if (captureIsStale) {
        recovering = true;
        const recoveryClaim = await db.paymentAttempt.updateMany({
          where: {
            id: activeAttempt.id,
            status: PaymentAttemptStatus.CAPTURE_PENDING,
            captureRequestedAt: { lte: staleBefore },
            ...leaseAvailable,
          },
          data: {
            captureLeaseToken: leaseToken,
            captureLeaseUntil: leaseUntil,
            lastCheckedAt: now,
          },
        });
        claimed = recoveryClaim.count === 1;
      }
    }

    if (!claimed) {
      const status = activeAttempt.status === PaymentAttemptStatus.STATUS_UNKNOWN
        ? "STATUS_UNKNOWN"
        : "CAPTURE_PENDING";
      const safeResult: CapturePaymentResult = {
        transactionId: transaction.id,
        status,
        amount: transaction.amount.toString(),
        currency: transaction.currency,
        providerCaptureId: activeAttempt.providerCaptureId || undefined,
      };
      await db.idempotencyOperation.update({
        where: { id: idempotencyOp.id },
        data: {
          status: IdempotencyStatus.UNKNOWN,
          safeResult: safeResult as unknown as Prisma.InputJsonValue,
        },
      });
      return safeResult;
    }

    const providerCaptureRequestId = `gp_cap_${createHash("sha256")
      .update(activeAttempt.id)
      .digest("hex")
      .slice(0, 26)}`;

    let orderDetails;
    try {
      orderDetails = await this.client.getOrder(activeAttempt.providerOrderId);
    } catch {
      return this.persistUncertainCapture({
        transaction,
        attempt: { ...activeAttempt, status: activeAttempt.status === PaymentAttemptStatus.AWAITING_APPROVAL
          ? PaymentAttemptStatus.CAPTURE_PENDING
          : activeAttempt.status },
        leaseToken,
        idempotencyOperationId: idempotencyOp.id,
        requestId,
        reason: "ORDER_INQUIRY_FAILED",
        payeeVerified: false,
      });
    }

    const payeeVerified =
      typeof orderDetails.payeeEmail === "string" &&
      orderDetails.payeeEmail.trim().toLowerCase() === config.payeeEmail.trim().toLowerCase();
    if (
      orderDetails.id !== activeAttempt.providerOrderId ||
      orderDetails.currency !== transaction.currency ||
      !amountMatches(orderDetails.amount, transaction.amount) ||
      !payeeVerified
    ) {
      return this.persistUncertainCapture({
        transaction,
        attempt: { ...activeAttempt, status: activeAttempt.status === PaymentAttemptStatus.AWAITING_APPROVAL
          ? PaymentAttemptStatus.CAPTURE_PENDING
          : activeAttempt.status },
        leaseToken,
        idempotencyOperationId: idempotencyOp.id,
        requestId,
        reason: orderDetails.id !== activeAttempt.providerOrderId
          ? "ORDER_ID_MISMATCH"
          : orderDetails.currency !== transaction.currency
            ? "ORDER_CURRENCY_MISMATCH"
            : !amountMatches(orderDetails.amount, transaction.amount)
              ? "ORDER_AMOUNT_MISMATCH"
              : "PAYEE_MISSING_OR_MISMATCHED",
        providerStatus: orderDetails.status,
        providerAmount: orderDetails.amount,
        providerCurrency: orderDetails.currency,
        payeeVerified,
      });
    }

    if (orderDetails.status === "COMPLETED") {
      const captures = orderDetails.captures || [];
      const recoveredCapture = captures.length === 1 ? captures[0] : undefined;
      const captureIsVerified =
        !!recoveredCapture?.id &&
        recoveredCapture.status === "COMPLETED" &&
        recoveredCapture.currency === transaction.currency &&
        amountMatches(recoveredCapture.amount, transaction.amount);

      if (!captureIsVerified || !recoveredCapture?.id) {
        return this.persistUncertainCapture({
          transaction,
          attempt: { ...activeAttempt, status: activeAttempt.status === PaymentAttemptStatus.AWAITING_APPROVAL
            ? PaymentAttemptStatus.CAPTURE_PENDING
            : activeAttempt.status },
          leaseToken,
          idempotencyOperationId: idempotencyOp.id,
          requestId,
          reason: "RECOVERED_CAPTURE_EVIDENCE_INCOMPLETE_OR_MISMATCHED",
          providerStatus: recoveredCapture?.status || orderDetails.status,
          providerAmount: recoveredCapture?.amount,
          providerCurrency: recoveredCapture?.currency,
          providerCaptureId: recoveredCapture?.id,
          payeeVerified,
        });
      }

      return this.persistCompletedCapture({
        transaction,
        attempt: { ...activeAttempt, status: activeAttempt.status === PaymentAttemptStatus.AWAITING_APPROVAL
          ? PaymentAttemptStatus.CAPTURE_PENDING
          : activeAttempt.status },
        leaseToken,
        idempotencyOperationId: idempotencyOp.id,
        requestId,
        captureId: recoveredCapture.id,
        recovered: true,
      });
    }

    if (orderDetails.status !== "APPROVED") {
      if (orderDetails.captures?.length) {
        return this.persistUncertainCapture({
          transaction,
          attempt: { ...activeAttempt, status: activeAttempt.status === PaymentAttemptStatus.AWAITING_APPROVAL
            ? PaymentAttemptStatus.CAPTURE_PENDING
            : activeAttempt.status },
          leaseToken,
          idempotencyOperationId: idempotencyOp.id,
          requestId,
          reason: "ORDER_HAS_CAPTURE_WITH_UNEXPECTED_STATUS",
          providerStatus: orderDetails.status,
          payeeVerified,
        });
      }

      if (orderDetails.status === "VOIDED" || orderDetails.status === "EXPIRED") {
        await db.$transaction(async (tx) => {
          await tx.paymentAttempt.update({
            where: { id: activeAttempt.id, captureLeaseToken: leaseToken },
            data: {
              status: PaymentAttemptStatus.FAILED,
              providerStatus: orderDetails.status,
              reconciliationNeeded: false,
              failureCode: "ORDER_VOIDED",
              captureLeaseToken: null,
              captureLeaseUntil: null,
              events: {
                create: {
                  transactionId: transaction.id,
                  eventType: "PAYPAL_ORDER_TERMINAL_FAILURE",
                  fromStatus: activeAttempt.status,
                  toStatus: PaymentAttemptStatus.FAILED,
                  source: "PAYPAL_API",
                  requestId: requestId || null,
                  metadata: { providerStatus: orderDetails.status },
                },
              },
            },
          });
          await tx.transaction.update({
            where: { id: transaction.id },
            data: {
              status: TransactionStatus.FAILED,
              failureCode: "ORDER_VOIDED",
              events: {
                create: {
                  eventType: "TRANSACTION_FAILED",
                  fromStatus: transaction.status,
                  toStatus: TransactionStatus.FAILED,
                  source: "PAYPAL_API",
                  requestId: requestId || null,
                  metadata: { providerStatus: orderDetails.status },
                },
              },
            },
          });
          await tx.idempotencyOperation.update({
            where: { id: idempotencyOp.id },
            data: { status: IdempotencyStatus.FAILED },
          });
        });
      } else {
        await db.$transaction(async (tx) => {
          const release = await tx.paymentAttempt.updateMany({
            where: { id: activeAttempt.id, captureLeaseToken: leaseToken },
            data: {
              status: PaymentAttemptStatus.AWAITING_APPROVAL,
              providerStatus: orderDetails.status,
              reconciliationNeeded: false,
              captureLeaseToken: null,
              captureLeaseUntil: null,
            },
          });
          if (release.count === 1) {
            await tx.transaction.update({
              where: { id: transaction.id },
              data: {
                status: TransactionStatus.AWAITING_APPROVAL,
                events: {
                  create: {
                    eventType: "PAYPAL_ORDER_NOT_APPROVED",
                    fromStatus: transaction.status,
                    toStatus: TransactionStatus.AWAITING_APPROVAL,
                    source: "PAYPAL_API",
                    requestId: requestId || null,
                    metadata: { providerStatus: orderDetails.status },
                  },
                },
              },
            });
          }
          await tx.idempotencyOperation.update({
            where: { id: idempotencyOp.id },
            data: { status: IdempotencyStatus.FAILED },
          });
        });
      }

      throw new ApiError({
        statusCode: 409,
        code: "ORDER_NOT_APPROVED",
        message: `PayPal order status is ${orderDetails.status}. Buyer approval is required before capture.`,
      });
    }

    if (orderDetails.captures?.length) {
      return this.persistUncertainCapture({
        transaction,
        attempt: { ...activeAttempt, status: activeAttempt.status === PaymentAttemptStatus.AWAITING_APPROVAL
          ? PaymentAttemptStatus.CAPTURE_PENDING
          : activeAttempt.status },
        leaseToken,
        idempotencyOperationId: idempotencyOp.id,
        requestId,
        reason: "APPROVED_ORDER_ALREADY_HAS_CAPTURE",
        providerStatus: orderDetails.status,
        payeeVerified,
      });
    }

    if (recovering && activeAttempt.status === PaymentAttemptStatus.STATUS_UNKNOWN) {
      const captureTransition = await db.$transaction(async (tx) => {
        const attemptTransition = await tx.paymentAttempt.updateMany({
          where: {
            id: activeAttempt.id,
            status: PaymentAttemptStatus.STATUS_UNKNOWN,
            captureLeaseToken: leaseToken,
          },
          data: {
            status: PaymentAttemptStatus.CAPTURE_PENDING,
            captureRequestedAt: now,
          },
        });
        if (attemptTransition.count !== 1) return false;
        const transactionTransition = await tx.transaction.updateMany({
          where: { id: transaction.id, status: TransactionStatus.STATUS_UNKNOWN },
          data: { status: TransactionStatus.CAPTURE_PENDING },
        });
        if (transactionTransition.count !== 1) {
          throw new Error("PAYMENT_STATE_CHANGED_DURING_RECOVERY");
        }
        return true;
      });
      if (!captureTransition) {
        return {
          transactionId: transaction.id,
          status: "STATUS_UNKNOWN",
          amount: transaction.amount.toString(),
          currency: transaction.currency,
          providerCaptureId: activeAttempt.providerCaptureId || undefined,
        };
      }
    }

    let captureResponse;
    try {
      captureResponse = await this.client.captureOrder(activeAttempt.providerOrderId, providerCaptureRequestId);
    } catch {
      return this.persistUncertainCapture({
        transaction,
        attempt: { ...activeAttempt, status: PaymentAttemptStatus.CAPTURE_PENDING },
        leaseToken,
        idempotencyOperationId: idempotencyOp.id,
        requestId,
        reason: "CAPTURE_RESPONSE_UNCERTAIN",
        payeeVerified,
      });
    }

    const capturePayeeVerified =
      typeof captureResponse.payeeEmail === "string" &&
      captureResponse.payeeEmail.trim().toLowerCase() === config.payeeEmail.trim().toLowerCase();
    const captureIsVerified =
      captureResponse.status === "COMPLETED" &&
      !!captureResponse.captureId &&
      captureResponse.currency === transaction.currency &&
      amountMatches(captureResponse.amount, transaction.amount) &&
      capturePayeeVerified;

    if (!captureIsVerified || !captureResponse.captureId) {
      return this.persistUncertainCapture({
        transaction,
        attempt: { ...activeAttempt, status: PaymentAttemptStatus.CAPTURE_PENDING },
        leaseToken,
        idempotencyOperationId: idempotencyOp.id,
        requestId,
        reason: captureResponse.status !== "COMPLETED"
          ? "CAPTURE_STATUS_UNVERIFIED"
          : !captureResponse.captureId
            ? "CAPTURE_ID_MISSING"
            : captureResponse.currency !== transaction.currency
              ? "CAPTURE_CURRENCY_MISMATCH"
              : !amountMatches(captureResponse.amount, transaction.amount)
                ? "CAPTURE_AMOUNT_MISMATCH"
                : "CAPTURE_PAYEE_MISSING_OR_MISMATCHED",
        providerStatus: captureResponse.status,
        providerAmount: captureResponse.amount,
        providerCurrency: captureResponse.currency,
        providerCaptureId: captureResponse.captureId,
        payeeVerified: capturePayeeVerified,
      });
    }

    try {
      return await this.persistCompletedCapture({
        transaction,
        attempt: { ...activeAttempt, status: PaymentAttemptStatus.CAPTURE_PENDING },
        leaseToken,
        idempotencyOperationId: idempotencyOp.id,
        requestId,
        captureId: captureResponse.captureId,
        recovered: false,
      });
    } catch (dbErr) {
      logger.error("DB commit failed after PayPal capture verification", {
        requestId,
        context: {
          transactionId: transaction.id,
          paymentAttemptId: activeAttempt.id,
          providerCaptureId: captureResponse.captureId,
        },
        error: dbErr,
      });
      return this.persistUncertainCapture({
        transaction,
        attempt: { ...activeAttempt, status: PaymentAttemptStatus.CAPTURE_PENDING },
        leaseToken,
        idempotencyOperationId: idempotencyOp.id,
        requestId,
        reason: "LOCAL_PERSISTENCE_FAILED_AFTER_CAPTURE",
        providerStatus: captureResponse.status,
        providerAmount: captureResponse.amount,
        providerCurrency: captureResponse.currency,
        providerCaptureId: captureResponse.captureId,
        payeeVerified: capturePayeeVerified,
      });
    }
  }

  /**
   * Verifies an AWAITING_APPROVAL attempt with PayPal and records only a
   * definitive outcome (payment-flow.md Step 3: "verify the order's actual
   * provider status before marking the transaction CANCELLED").
   *
   * - Buyer returned via the cancel URL and PayPal shows the order unapproved -> CANCELLED.
   * - PayPal reports EXPIRED, or the order is gone (404) after STALE_APPROVAL_AGE_MS -> CANCELLED (expired).
   * - PayPal reports VOIDED -> FAILED.
   * - APPROVED / COMPLETED / unreachable provider -> left unchanged so capture can still proceed.
   *
   * Uses the same per-attempt lease as capture, so it can never race a capture.
   */
  async reconcileAwaitingApproval(
    sessionId: string,
    params: { providerOrderId: string; reason: ReconcileApprovalReason },
    requestId?: string
  ): Promise<ReconcileApprovalResult> {
    const attempt = await db.paymentAttempt.findFirst({
      where: {
        provider: PaymentProvider.PAYPAL,
        providerOrderId: params.providerOrderId,
        transaction: { demoSessionId: sessionId },
      },
      include: { transaction: { select: { id: true, status: true, merchantId: true } } },
    });

    if (!attempt) {
      throw ApiError.notFound("Payment order not found for this session.");
    }

    const unchanged = (status: TransactionStatus = attempt.transaction.status): ReconcileApprovalResult => ({
      transactionId: attempt.transaction.id,
      merchantId: attempt.transaction.merchantId,
      status,
      outcome: "UNCHANGED",
    });

    if (
      attempt.status !== PaymentAttemptStatus.AWAITING_APPROVAL ||
      attempt.transaction.status !== TransactionStatus.AWAITING_APPROVAL
    ) {
      return unchanged();
    }

    const now = new Date();
    const leaseToken = randomUUID();
    const claim = await db.paymentAttempt.updateMany({
      where: {
        id: attempt.id,
        status: PaymentAttemptStatus.AWAITING_APPROVAL,
        OR: [{ captureLeaseUntil: null }, { captureLeaseUntil: { lte: now } }],
      },
      data: {
        captureLeaseToken: leaseToken,
        captureLeaseUntil: new Date(now.getTime() + CAPTURE_LEASE_MS),
        lastCheckedAt: now,
      },
    });
    if (claim.count !== 1) {
      // A capture or another reconciliation currently holds this attempt.
      return unchanged();
    }

    const releaseLease = async (providerStatus?: string) => {
      await db.paymentAttempt.updateMany({
        where: { id: attempt.id, captureLeaseToken: leaseToken },
        data: {
          captureLeaseToken: null,
          captureLeaseUntil: null,
          ...(providerStatus ? { providerStatus } : {}),
        },
      });
    };

    let providerStatus: string;
    try {
      const order = await this.client.getOrder(params.providerOrderId);
      if (order.id !== params.providerOrderId) {
        await releaseLease();
        return unchanged();
      }
      providerStatus = order.status;
    } catch (error) {
      if (error instanceof PayPalOrderNotFoundError) {
        providerStatus = "NOT_FOUND";
      } else {
        logger.warn("PayPal order inquiry failed during approval reconciliation", {
          requestId,
          context: { transactionId: attempt.transaction.id, paymentAttemptId: attempt.id, reason: params.reason },
        });
        await releaseLease();
        return unchanged();
      }
    }

    const ageMs = now.getTime() - attempt.createdAt.getTime();
    let decision: {
      attemptStatus: PaymentAttemptStatus;
      transactionStatus: TransactionStatus;
      failureCode: string;
      outcome: ReconcileApprovalResult["outcome"];
    } | null = null;

    if (providerStatus === "EXPIRED" || (providerStatus === "NOT_FOUND" && ageMs >= STALE_APPROVAL_AGE_MS)) {
      decision = {
        attemptStatus: PaymentAttemptStatus.CANCELLED,
        transactionStatus: TransactionStatus.CANCELLED,
        failureCode: "PAYPAL_ORDER_EXPIRED",
        outcome: "EXPIRED",
      };
    } else if (providerStatus === "VOIDED") {
      decision = {
        attemptStatus: PaymentAttemptStatus.FAILED,
        transactionStatus: TransactionStatus.FAILED,
        failureCode: "ORDER_VOIDED",
        outcome: "FAILED",
      };
    } else if (
      params.reason === "BUYER_RETURNED_TO_CANCEL_URL" &&
      UNAPPROVED_ORDER_STATES.has(providerStatus)
    ) {
      decision = {
        attemptStatus: PaymentAttemptStatus.CANCELLED,
        transactionStatus: TransactionStatus.CANCELLED,
        failureCode: "BUYER_CANCELLED",
        outcome: "CANCELLED",
      };
    }

    if (!decision) {
      await releaseLease(providerStatus === "NOT_FOUND" ? undefined : providerStatus);
      return unchanged();
    }

    const finalDecision = decision;
    const metadata = { providerStatus, reason: params.reason, failureCode: finalDecision.failureCode };
    try {
      await db.$transaction(async (tx) => {
        await tx.paymentAttempt.update({
          where: { id: attempt.id, captureLeaseToken: leaseToken, status: PaymentAttemptStatus.AWAITING_APPROVAL },
          data: {
            status: finalDecision.attemptStatus,
            providerStatus,
            failureCode: finalDecision.failureCode,
            reconciliationNeeded: false,
            lastCheckedAt: now,
            captureLeaseToken: null,
            captureLeaseUntil: null,
            events: {
              create: {
                transactionId: attempt.transaction.id,
                eventType: "PAYPAL_APPROVAL_RECONCILED",
                fromStatus: PaymentAttemptStatus.AWAITING_APPROVAL,
                toStatus: finalDecision.attemptStatus,
                source: "PAYPAL_API",
                requestId: requestId || null,
                metadata,
              },
            },
          },
        });
        await tx.transaction.update({
          where: { id: attempt.transaction.id, status: TransactionStatus.AWAITING_APPROVAL },
          data: {
            status: finalDecision.transactionStatus,
            failureCode: finalDecision.failureCode,
            events: {
              create: {
                eventType:
                  finalDecision.transactionStatus === TransactionStatus.CANCELLED
                    ? "TRANSACTION_CANCELLED"
                    : "TRANSACTION_FAILED",
                fromStatus: TransactionStatus.AWAITING_APPROVAL,
                toStatus: finalDecision.transactionStatus,
                source: "PAYPAL_API",
                requestId: requestId || null,
                metadata,
              },
            },
          },
        });
      });
    } catch (error) {
      logger.warn("Approval reconciliation could not be persisted; state left unchanged", {
        requestId,
        context: { transactionId: attempt.transaction.id, paymentAttemptId: attempt.id },
        error,
      });
      await releaseLease();
      const current = await db.transaction.findUnique({
        where: { id: attempt.transaction.id },
        select: { status: true },
      });
      return unchanged(current?.status ?? attempt.transaction.status);
    }

    logger.info("PayPal approval reconciled", {
      requestId,
      context: { transactionId: attempt.transaction.id, paymentAttemptId: attempt.id, ...metadata },
    });

    return {
      transactionId: attempt.transaction.id,
      merchantId: attempt.transaction.merchantId,
      status: finalDecision.transactionStatus,
      outcome: finalDecision.outcome,
    };
  }

  /**
   * Bounded reconciliation of this session's abandoned approvals (buyer closed
   * the PayPal window). Only attempts older than STALE_APPROVAL_AGE_MS are
   * checked, at most once per STALE_APPROVAL_RECHECK_MS, and never more than
   * STALE_APPROVAL_SWEEP_LIMIT per call. Never captures and never throws.
   */
  async reconcileStaleApprovals(sessionId: string, requestId?: string): Promise<number> {
    const now = Date.now();
    let changed = 0;
    try {
      const stale = await db.paymentAttempt.findMany({
        where: {
          provider: PaymentProvider.PAYPAL,
          status: PaymentAttemptStatus.AWAITING_APPROVAL,
          providerOrderId: { not: null },
          createdAt: { lte: new Date(now - STALE_APPROVAL_AGE_MS) },
          OR: [
            { lastCheckedAt: null },
            { lastCheckedAt: { lte: new Date(now - STALE_APPROVAL_RECHECK_MS) } },
          ],
          transaction: { demoSessionId: sessionId, status: TransactionStatus.AWAITING_APPROVAL },
        },
        select: { providerOrderId: true },
        orderBy: { createdAt: "asc" },
        take: STALE_APPROVAL_SWEEP_LIMIT,
      });

      for (const item of stale) {
        if (!item.providerOrderId) continue;
        try {
          const result = await this.reconcileAwaitingApproval(
            sessionId,
            { providerOrderId: item.providerOrderId, reason: "STALE_APPROVAL_SWEEP" },
            requestId
          );
          if (result.outcome !== "UNCHANGED") changed++;
        } catch (error) {
          logger.warn("Stale approval reconciliation failed for one attempt", { requestId, error });
        }
      }
    } catch (error) {
      logger.warn("Stale approval sweep failed", { requestId, error });
    }
    return changed;
  }
}

export const payPalPaymentService = new PayPalPaymentService();

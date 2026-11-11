// =============================================================================
// GlobalPay — Transaction Service
// =============================================================================
// PRD §7.2, api-contract.md §7, payment-flow.md §17.2:
// Server-only transaction creation, verification, and audit event management.
// =============================================================================

import "server-only";
import {
  PaymentAttemptStatus,
  PaymentEnvironment,
  PaymentProvider,
  Prisma,
  TransactionStatus,
} from "@prisma/client";
import { db } from "../db";
import { ApiError } from "../errors/api-error";
import { getDemoMerchantAmount, formatSafeMerchantSummary } from "../merchants/merchant-service";
import { evaluatePaymentEligibility } from "./eligibility";
import { multiplyAndDivide } from "../currency/decimal";
import { getCurrency, type CurrencyCode } from "@/features/currency/currencies";
import { isSupportedFxCurrency } from "../fx/fx-provider";

interface StoredQuoteSnapshot {
  quoteId?: string;
  source?: string;
  rate?: string;
  asOf?: string;
  baseCurrency?: string;
  quoteCurrency?: string;
}

export interface TransactionSummaryOutput {
  id: string;
  merchant: {
    id: string;
    slug: string | null;
    name: string;
    category: string;
    countryCode: string | null;
  };
  amount: string;
  currency: string;
  status: TransactionStatus;
  indicativeEstimate?: {
    homeCurrency: string;
    estimatedHomeAmount: string;
    rate: string;
    asOf?: string;
  };
  createdAt: string;
}

export interface TransactionDetailOutput
  extends Omit<TransactionSummaryOutput, "merchant" | "indicativeEstimate"> {
  merchant: {
    name: string;
    countryCode: string | null;
  };
  indicativeEstimate?: NonNullable<TransactionSummaryOutput["indicativeEstimate"]> & {
    baseCurrency?: string;
    quoteCurrency?: string;
  };
  completedAt?: string;
  providerCaptureId?: string;
}

export class TransactionService {
  /**
   * Creates an internal transaction record after verifying session ownership,
   * bank linking eligibility, merchant active status, and currency agreement.
   */
  async createTransaction(
    sessionId: string,
    params: {
      merchantId: string;
      amount: string;
      currency: string;
      quoteId?: string;
    },
    requestId?: string
  ): Promise<TransactionSummaryOutput> {
    // 1. Enforce Bank Linking Eligibility
    const eligibility = await evaluatePaymentEligibility(sessionId);
    if (!eligibility.eligible) {
      throw ApiError.bankLinkingRequired(eligibility.explanation);
    }

    // 2. Validate Merchant existence and active status
    const merchant = await db.merchant.findFirst({
      where: {
        OR: [{ id: params.merchantId }, { slug: params.merchantId }],
      },
    });

    if (!merchant || !merchant.isActive) {
      throw ApiError.notFound("The requested merchant is not available for payment.");
    }

    // 3. Only configured demo merchants with a server-owned PayPal Sandbox price are payable.
    const safeMerchant = formatSafeMerchantSummary(merchant);
    const demoAmount = getDemoMerchantAmount(merchant.slug);
    if (
      !merchant.isDemo ||
      !safeMerchant.supportedMethods.includes("PAYPAL_SANDBOX") ||
      demoAmount === null
    ) {
      throw ApiError.notFound("The requested merchant is not available for payment.");
    }

    // 4. Validate Currency matches merchant display currency
    if (merchant.displayCurrency.toUpperCase() !== params.currency.toUpperCase()) {
      throw new ApiError({
        statusCode: 422,
        code: "UNSUPPORTED_CURRENCY",
        message: `Merchant charges in ${merchant.displayCurrency}. Submitted currency ${params.currency} does not match.`,
      });
    }

    // 5. The client may display the sample amount but cannot choose or change it.
    const expectedAmount = new Prisma.Decimal(demoAmount);
    const submittedAmount = new Prisma.Decimal(params.amount);
    if (!submittedAmount.equals(expectedAmount)) {
      throw new ApiError({
        statusCode: 422,
        code: "INVALID_AMOUNT",
        message: "The submitted amount does not match the merchant's configured demo amount.",
      });
    }

    // 6. Validate and enforce currency decimal precision rules
    const currencyMeta = getCurrency(params.currency as CurrencyCode);
    const amountParts = params.amount.split(".");
    const fraction = amountParts[1] || "";
    if (currencyMeta.decimals === 0 && fraction.length > 0) {
      throw new ApiError({
        statusCode: 422,
        code: "INVALID_AMOUNT",
        message: `${params.currency} does not support fractional decimal places.`,
      });
    }
    if (fraction.length > currencyMeta.decimals) {
      throw new ApiError({
        statusCode: 422,
        code: "INVALID_AMOUNT",
        message: `${params.currency} supports at most ${currencyMeta.decimals} decimal places.`,
      });
    }

    // 7. FX Quote Snapshot Resolution
    let homeCurrency: string | undefined;
    let indicativeRate: Prisma.Decimal | undefined;
    let estimatedHomeAmount: Prisma.Decimal | undefined;
    let quoteSnapshot: Prisma.InputJsonValue | undefined;

    if (params.quoteId) {
      const [preference, quote] = await Promise.all([
        db.travellerPreference.findUnique({
          where: { sessionId },
          select: { displayCurrency: true },
        }),
        db.currencyQuote.findUnique({
          where: { id: params.quoteId },
        }),
      ]);

      if (
        !quote ||
        !quote.isIndicative ||
        (quote.expiresAt !== null && quote.expiresAt <= new Date()) ||
        !quote.baseAmount.equals(expectedAmount) ||
        quote.baseCurrency !== merchant.displayCurrency ||
        !isSupportedFxCurrency(quote.quoteCurrency) ||
        (preference && preference.displayCurrency !== quote.quoteCurrency)
      ) {
        throw new ApiError({
          statusCode: 422,
          code: "QUOTE_INVALID_OR_EXPIRED",
          message: "The indicative quote is unavailable or does not match this payment.",
        });
      }

      homeCurrency = quote.quoteCurrency;
      indicativeRate = quote.rate;
      const homeMeta = getCurrency(homeCurrency as CurrencyCode);
      const calculatedHomeStr = multiplyAndDivide(
        expectedAmount.toString(),
        quote.rate.toString(),
        "1",
        homeMeta.decimals
      );
      estimatedHomeAmount = new Prisma.Decimal(calculatedHomeStr);
      quoteSnapshot = {
        quoteId: quote.id,
        source: quote.source,
        rate: quote.rate.toString(),
        asOf: quote.asOf.toISOString(),
        baseCurrency: quote.baseCurrency,
        quoteCurrency: quote.quoteCurrency,
      };
    }

    // 8. Create Transaction and initial TransactionEvent atomically
    const transaction = await db.transaction.create({
      data: {
        demoSessionId: sessionId,
        merchantId: merchant.id,
        currencyQuoteId: params.quoteId || null,
        amount: new Prisma.Decimal(params.amount),
        currency: params.currency.toUpperCase(),
        homeCurrency: homeCurrency || null,
        indicativeRate: indicativeRate || null,
        estimatedHomeAmount: estimatedHomeAmount || null,
        quoteSnapshot: quoteSnapshot || Prisma.JsonNull,
        status: TransactionStatus.CREATED,
        events: {
          create: {
            eventType: "TRANSACTION_CREATED",
            fromStatus: null,
            toStatus: TransactionStatus.CREATED,
            source: "API",
            requestId: requestId || null,
            metadata: {
              merchantId: merchant.id,
              amount: params.amount,
              currency: params.currency,
            },
          },
        },
      },
      include: {
        merchant: true,
      },
    });

    return {
      id: transaction.id,
      merchant: {
        id: transaction.merchant.id,
        slug: transaction.merchant.slug,
        name: transaction.merchant.name,
        category: transaction.merchant.category,
        countryCode: transaction.merchant.countryCode,
      },
      amount: transaction.amount.toString(),
      currency: transaction.currency,
      status: transaction.status,
      indicativeEstimate:
        homeCurrency && estimatedHomeAmount && indicativeRate
          ? {
              homeCurrency,
              estimatedHomeAmount: estimatedHomeAmount.toString(),
              rate: indicativeRate.toString(),
              asOf: (quoteSnapshot as StoredQuoteSnapshot | null)?.asOf,
            }
          : undefined,
      createdAt: transaction.createdAt.toISOString(),
    };
  }

  /**
   * Retrieves a single transaction strictly checking session ownership.
   */
  async getTransaction(sessionId: string, transactionId: string): Promise<TransactionDetailOutput> {
    const transaction = await db.transaction.findUnique({
      where: { id: transactionId },
      include: {
        merchant: true,
        paymentAttempts: {
          where: {
            provider: PaymentProvider.PAYPAL,
            environment: PaymentEnvironment.SANDBOX,
            status: PaymentAttemptStatus.COMPLETED,
            capturedAt: { not: null },
            providerCaptureId: { not: null },
          },
          orderBy: { capturedAt: "desc" },
          take: 1,
          select: { providerCaptureId: true },
        },
      },
    });

    if (!transaction || transaction.demoSessionId !== sessionId) {
      throw ApiError.notFound("The requested transaction was not found.");
    }

    const verifiedCapture =
      transaction.status === TransactionStatus.COMPLETED
        ? transaction.paymentAttempts.find((attempt) => attempt.providerCaptureId !== null)
        : undefined;
    const quoteSnapshot = transaction.quoteSnapshot as StoredQuoteSnapshot | null;

    return {
      id: transaction.id,
      merchant: {
        name: transaction.merchant.name,
        countryCode: transaction.merchant.countryCode,
      },
      amount: transaction.amount.toString(),
      currency: transaction.currency,
      status: transaction.status,
      indicativeEstimate:
        transaction.homeCurrency && transaction.estimatedHomeAmount && transaction.indicativeRate
          ? {
              homeCurrency: transaction.homeCurrency,
              estimatedHomeAmount: transaction.estimatedHomeAmount.toString(),
              rate: transaction.indicativeRate.toString(),
              asOf: quoteSnapshot?.asOf,
              baseCurrency: quoteSnapshot?.baseCurrency,
              quoteCurrency: quoteSnapshot?.quoteCurrency,
            }
          : undefined,
      createdAt: transaction.createdAt.toISOString(),
      completedAt:
        transaction.status === TransactionStatus.COMPLETED
          ? transaction.completedAt?.toISOString()
          : undefined,
      providerCaptureId: verifiedCapture?.providerCaptureId ?? undefined,
    };
  }

  /**
   * Lists transactions owned by the session.
   */
  async listTransactions(sessionId: string): Promise<TransactionSummaryOutput[]> {
    const list = await db.transaction.findMany({
      where: { demoSessionId: sessionId },
      include: { merchant: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return list.map((t) => ({
      id: t.id,
      merchant: {
        id: t.merchant.id,
        slug: t.merchant.slug,
        name: t.merchant.name,
        category: t.merchant.category,
        countryCode: t.merchant.countryCode,
      },
      amount: t.amount.toString(),
      currency: t.currency,
      status: t.status,
      indicativeEstimate:
        t.homeCurrency && t.estimatedHomeAmount && t.indicativeRate
          ? {
              homeCurrency: t.homeCurrency,
              estimatedHomeAmount: t.estimatedHomeAmount.toString(),
              rate: t.indicativeRate.toString(),
              asOf: (t.quoteSnapshot as StoredQuoteSnapshot | null)?.asOf,
            }
          : undefined,
      createdAt: t.createdAt.toISOString(),
    }));
  }
}

export const transactionService = new TransactionService();

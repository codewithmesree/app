// =============================================================================
// GlobalPay — Transactions API Route
// =============================================================================
// PRD §7.2, api-contract.md §7:
// POST /api/transactions — Create an internal transaction record.
// GET /api/transactions — List transactions for the authenticated session.
// =============================================================================

import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/ownership";
import { validateRequestOrigin } from "@/lib/auth/csrf";
import { createTransactionSchema } from "@/lib/validation/payment";
import { transactionService } from "@/lib/payments/transaction-service";
import { payPalPaymentService } from "@/lib/payments/paypal-payment-service";
import { handleApiError } from "@/lib/errors/error-handler";
import { resolveRequestId } from "@/lib/request-id";
import { ApiError } from "@/lib/errors/api-error";

export async function POST(request: Request) {
  const requestId = resolveRequestId(request);

  try {
    validateRequestOrigin(request);
    const session = await requireSession(request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw ApiError.badRequest("Malformed JSON in request body.");
    }

    const parseResult = createTransactionSchema.safeParse(body);
    if (!parseResult.success) {
      throw parseResult.error;
    }

    const transaction = await transactionService.createTransaction(
      session.id,
      parseResult.data,
      requestId
    );

    return NextResponse.json(
      { transaction },
      {
        status: 201,
        headers: {
          "x-request-id": requestId,
          "cache-control": "no-store",
        },
      }
    );
  } catch (error) {
    return handleApiError(error, request);
  }
}

export async function GET(request: Request) {
  const requestId = resolveRequestId(request);

  try {
    const session = await requireSession(request);
    // Reconcile this session's abandoned PayPal approvals (bounded, never throws)
    // so history reflects PayPal's authoritative state instead of staying pending forever.
    await payPalPaymentService.reconcileStaleApprovals(session.id, requestId);
    const transactions = await transactionService.listTransactions(session.id);

    return NextResponse.json(
      { transactions },
      {
        status: 200,
        headers: {
          "x-request-id": requestId,
          "cache-control": "no-store",
        },
      }
    );
  } catch (error) {
    return handleApiError(error, request);
  }
}


// =============================================================================
// GlobalPay — Transaction Detail API Route
// =============================================================================
// PRD §7.2, api-contract.md §7:
// GET /api/transactions/[id] — Retrieve an owned transaction.
// =============================================================================

import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/ownership";
import { transactionService } from "@/lib/payments/transaction-service";
import { handleApiError } from "@/lib/errors/error-handler";
import { resolveRequestId } from "@/lib/request-id";
import { ApiError } from "@/lib/errors/api-error";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = resolveRequestId(request);

  try {
    const session = await requireSession(request);
    const resolvedParams = await params;
    const transactionId = resolvedParams.id;

    if (!transactionId) {
      throw ApiError.badRequest("Transaction ID is required.");
    }

    const transaction = await transactionService.getTransaction(session.id, transactionId);

    return NextResponse.json(
      { transaction },
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


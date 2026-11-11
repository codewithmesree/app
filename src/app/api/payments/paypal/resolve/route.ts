// =============================================================================
// GlobalPay — PayPal Payment Resolve API Route
// =============================================================================
// PRD §7.3, api-contract.md §8:
// GET /api/payments/paypal/resolve?token=[orderId]
// Resolves a returning PayPal order token to a session-owned Transaction.
// Enforces session ownership and ensures payment return flow doesn't assume array order.
// =============================================================================

import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/ownership";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/errors/error-handler";
import { resolveRequestId } from "@/lib/request-id";
import { ApiError } from "@/lib/errors/api-error";
import { PaymentProvider } from "@prisma/client";

export async function GET(request: Request) {
  const requestId = resolveRequestId(request);

  try {
    const session = await requireSession(request);
    const url = new URL(request.url);
    const token = url.searchParams.get("token")?.trim();

    if (!token) {
      throw ApiError.badRequest("PayPal order token is required.");
    }

    // Find the payment attempt belonging to this providerOrderId and session
    const attempt = await db.paymentAttempt.findFirst({
      where: {
        provider: PaymentProvider.PAYPAL,
        providerOrderId: token,
        transaction: {
          demoSessionId: session.id,
        },
      },
      include: {
        transaction: {
          select: {
            id: true,
            status: true,
            amount: true,
            currency: true,
            demoSessionId: true,
          },
        },
      },
    });

    if (!attempt || !attempt.transaction) {
      throw ApiError.notFound("Payment order not found for this session.");
    }

    return NextResponse.json(
      {
        transactionId: attempt.transaction.id,
        status: attempt.transaction.status,
      },
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

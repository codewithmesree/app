// =============================================================================
// GlobalPay — PayPal Cancel Return Reconciliation API Route
// =============================================================================
// payment-flow.md Step 3 / PF-02:
// POST /api/payments/paypal/cancel { token } — called when PayPal redirects the
// buyer to the cancel URL. The server verifies the order's actual PayPal status
// before recording CANCELLED; a cancel return alone is never proof of outcome.
// Never captures, never trusts client-submitted status or amount.
// =============================================================================

import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/ownership";
import { validateRequestOrigin } from "@/lib/auth/csrf";
import { cancelPayPalPaymentSchema } from "@/lib/validation/payment";
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

    const parseResult = cancelPayPalPaymentSchema.safeParse(body);
    if (!parseResult.success) {
      throw parseResult.error;
    }

    const result = await payPalPaymentService.reconcileAwaitingApproval(
      session.id,
      { providerOrderId: parseResult.data.token, reason: "BUYER_RETURNED_TO_CANCEL_URL" },
      requestId
    );

    return NextResponse.json(result, {
      status: 200,
      headers: {
        "x-request-id": requestId,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error, request);
  }
}

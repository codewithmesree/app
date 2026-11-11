// =============================================================================
// GlobalPay — PayPal Payment Creation API Route
// =============================================================================
// PRD §7.3, api-contract.md §8:
// POST /api/payments/paypal/create — Create PayPal Sandbox order for transaction.
// =============================================================================

import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/ownership";
import { validateRequestOrigin } from "@/lib/auth/csrf";
import { createPayPalPaymentSchema } from "@/lib/validation/payment";
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

    const parseResult = createPayPalPaymentSchema.safeParse(body);
    if (!parseResult.success) {
      throw parseResult.error;
    }

    const result = await payPalPaymentService.createPayPalOrder(
      session.id,
      parseResult.data,
      requestId
    );

    return NextResponse.json(
      result,
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


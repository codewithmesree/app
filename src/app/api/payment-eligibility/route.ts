// =============================================================================
// GlobalPay — Payment Eligibility API Endpoint
// =============================================================================
// PRD §17.1, payment-flow.md §17.2, api-contract.md §2:
// - GET /api/payment-eligibility : Evaluate session payment eligibility
// =============================================================================

import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors/error-handler";
import { resolveRequestId } from "@/lib/request-id";
import { requireSession } from "@/lib/auth/ownership";
import { evaluatePaymentEligibility } from "@/lib/payments/eligibility";

/**
 * GET /api/payment-eligibility
 * Returns structured payment eligibility for the authenticated demo session.
 */
export async function GET(request: Request) {
  const requestId = resolveRequestId(request);

  try {
    const session = await requireSession(request);
    const eligibility = await evaluatePaymentEligibility(session.id);

    return NextResponse.json(eligibility, {
      status: 200,
      headers: {
        "x-request-id": requestId,
        "cache-control": "no-store, private",
      },
    });
  } catch (error) {
    return handleApiError(error, request, requestId);
  }
}


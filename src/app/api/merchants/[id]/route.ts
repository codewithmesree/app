// =============================================================================
// GlobalPay — Merchant Detail API
// =============================================================================
// PRD §17.1, api-contract.md §5.2:
// - GET /api/merchants/[id] : Retrieve a single merchant by ID or slug
// =============================================================================

import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors/error-handler";
import { resolveRequestId } from "@/lib/request-id";
import { getMerchantByIdOrSlug } from "@/lib/merchants/merchant-service";

type RouteProps = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/merchants/[id]
 * Public endpoint to fetch merchant profile and payment capabilities.
 */
export async function GET(request: Request, props: RouteProps) {
  const requestId = resolveRequestId(request);

  try {
    const { id } = await props.params;

    const merchant = await getMerchantByIdOrSlug(id);

    return NextResponse.json(
      { merchant },
      {
        status: 200,
        headers: {
          "x-request-id": requestId,
          "cache-control": "no-store",
        },
      }
    );
  } catch (error) {
    return handleApiError(error, request, requestId);
  }
}

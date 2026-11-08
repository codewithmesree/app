// =============================================================================
// GlobalPay — Merchant Catalogue API
// =============================================================================
// PRD §17.1, api-contract.md §5.1:
// - GET /api/merchants : Query supported demo merchants with filtering
// =============================================================================

import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors/error-handler";
import { ApiError } from "@/lib/errors/api-error";
import { resolveRequestId } from "@/lib/request-id";
import { listMerchants } from "@/lib/merchants/merchant-service";
import { merchantListQuerySchema } from "@/lib/validation/merchants";

/**
 * GET /api/merchants
 * Public exploration endpoint to discover demo merchants by country/category.
 */
export async function GET(request: Request) {
  const requestId = resolveRequestId(request);

  try {
    const { searchParams } = new URL(request.url);

    const rawParams = {
      countryCode: searchParams.get("countryCode") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      currency: searchParams.get("currency") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      cursor: searchParams.get("cursor") ?? undefined,
    };

    const parseResult = merchantListQuerySchema.safeParse(rawParams);
    if (!parseResult.success) {
      const details = parseResult.error.issues.map((issue) => ({
        field: issue.path.join("."),
        issue: issue.message,
      }));
      throw ApiError.validationError(details, "Invalid merchant query parameters.");
    }

    const result = await listMerchants(parseResult.data);

    return NextResponse.json(result, {
      status: 200,
      headers: {
        "x-request-id": requestId,
        "cache-control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    return handleApiError(error, request, requestId);
  }
}


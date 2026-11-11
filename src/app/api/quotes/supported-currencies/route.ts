// =============================================================================
// GlobalPay — Supported Currencies API Route
// =============================================================================
// PRD §7.4, api-contract.md §6:
// GET /api/quotes/supported-currencies — Return supported currencies and metadata.
// =============================================================================

import { NextResponse } from "next/server";
import { quoteService } from "@/lib/fx/quote-service";
import { handleApiError } from "@/lib/errors/error-handler";
import { resolveRequestId } from "@/lib/request-id";

export async function GET(request: Request) {
  const requestId = resolveRequestId(request);

  try {
    const currencies = quoteService.getSupportedCurrencies();

    return NextResponse.json(
      { currencies },
      {
        status: 200,
        headers: {
          "x-request-id": requestId,
          "cache-control": "public, max-age=3600",
        },
      }
    );
  } catch (error) {
    return handleApiError(error, request);
  }
}


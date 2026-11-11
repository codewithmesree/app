// =============================================================================
// GlobalPay — Currency Quote API Route
// =============================================================================
// PRD §7.4, api-contract.md §6:
// POST /api/currency/quote — Request an indicative conversion quote.
// =============================================================================

import { NextResponse } from "next/server";
import { quoteRequestSchema } from "@/lib/validation/currency";
import { quoteService } from "@/lib/fx/quote-service";
import { handleApiError } from "@/lib/errors/error-handler";
import { resolveRequestId } from "@/lib/request-id";
import { ApiError } from "@/lib/errors/api-error";

export async function POST(request: Request) {
  const requestId = resolveRequestId(request);

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw ApiError.badRequest("Malformed JSON in request body.");
    }

    const parseResult = quoteRequestSchema.safeParse(body);
    if (!parseResult.success) {
      // Map Zod issue to appropriate error codes if it is unsupported currency or invalid amount
      const currencyIssue = parseResult.error.issues.find(
        (i) => i.path.includes("baseCurrency") || i.path.includes("quoteCurrency")
      );
      if (currencyIssue && currencyIssue.message.toLowerCase().includes("unsupported")) {
        throw new ApiError({
          statusCode: 422,
          code: "UNSUPPORTED_CURRENCY",
          message: currencyIssue.message,
        });
      }

      const amountIssue = parseResult.error.issues.find((i) => i.path.includes("baseAmount"));
      if (amountIssue) {
        throw new ApiError({
          statusCode: 422,
          code: "INVALID_AMOUNT",
          message: amountIssue.message,
        });
      }

      throw parseResult.error;
    }

    const { baseAmount, baseCurrency, quoteCurrency } = parseResult.data;
    const quote = await quoteService.getQuote(baseAmount, baseCurrency, quoteCurrency);

    return NextResponse.json(
      {
        quote,
        disclaimer: "Indicative estimate only; the final conversion amount may differ.",
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


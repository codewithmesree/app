// =============================================================================
// GlobalPay — Bank Connection Link Action API
// =============================================================================
// PRD §17.1, api-contract.md §2:
// - POST /api/bank-connection/link : Initiate or complete simulated bank linking
// =============================================================================

import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors/error-handler";
import { ApiError } from "@/lib/errors/api-error";
import { resolveRequestId } from "@/lib/request-id";
import { validateRequestOrigin } from "@/lib/auth/csrf";
import { requireSession } from "@/lib/auth/ownership";
import {
  initiateBankLink,
  completeBankLink,
  simulateStatus,
  type SafeBankConnection,
} from "@/lib/bank-linking/bank-service";
import { bankLinkActionSchema } from "@/lib/validation/bank";

/**
 * POST /api/bank-connection/link
 * Drives simulated connection lifecycle transitions.
 */
export async function POST(request: Request) {
  const requestId = resolveRequestId(request);

  try {
    // 1. Anti-CSRF verification
    validateRequestOrigin(request);

    // 2. Authentication check
    const session = await requireSession(request);

    // 3. Body parsing & validation
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw ApiError.badRequest("Invalid JSON body.");
    }

    const parseResult = bankLinkActionSchema.safeParse(body);
    if (!parseResult.success) {
      const details = parseResult.error.issues.map((issue) => ({
        field: issue.path.join("."),
        issue: issue.message,
      }));
      throw ApiError.validationError(
        details,
        "Invalid bank link action submission."
      );
    }

    const input = parseResult.data;
    let connection: SafeBankConnection;

    switch (input.action) {
      case "initiate":
        connection = await initiateBankLink(session.id, input.institutionId);
        break;

      case "complete":
        connection = await completeBankLink(
          session.id,
          input.institutionId,
          input.simulateFailure,
          input.failureReason
        );
        break;

      case "simulate_status":
        connection = await simulateStatus(session.id, input.status);
        break;
    }

    return NextResponse.json(
      { connection },
      {
        status: 200,
        headers: {
          "x-request-id": requestId,
          "cache-control": "no-store, private",
        },
      }
    );
  } catch (error) {
    return handleApiError(error, request, requestId);
  }
}


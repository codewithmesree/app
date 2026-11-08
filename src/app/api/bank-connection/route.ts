// =============================================================================
// GlobalPay — Bank Connection API Endpoints
// =============================================================================
// PRD §17.1, api-contract.md §2:
// - GET    /api/bank-connection : Retrieve current session bank connection
// - DELETE /api/bank-connection : Disconnect bank connection
// =============================================================================

import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors/error-handler";
import { resolveRequestId } from "@/lib/request-id";
import { validateRequestOrigin } from "@/lib/auth/csrf";
import { requireSession } from "@/lib/auth/ownership";
import {
  getBankConnection,
  disconnectBank,
} from "@/lib/bank-linking/bank-service";

/**
 * GET /api/bank-connection
 * Retrieves bank connection state for the authenticated session.
 */
export async function GET(request: Request) {
  const requestId = resolveRequestId(request);

  try {
    const session = await requireSession(request);
    const connection = await getBankConnection(session.id);

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

/**
 * DELETE /api/bank-connection
 * Disconnects the current bank connection and resets to explore-only mode.
 */
export async function DELETE(request: Request) {
  const requestId = resolveRequestId(request);

  try {
    // 1. Anti-CSRF verification
    validateRequestOrigin(request);

    // 2. Authentication check
    const session = await requireSession(request);

    // 3. Disconnect connection in DB
    const connection = await disconnectBank(session.id);

    return NextResponse.json(
      {
        success: true,
        connection,
      },
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


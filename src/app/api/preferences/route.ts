// =============================================================================
// GlobalPay — Preferences API Endpoint
// =============================================================================
// PRD §17.1, api-contract.md §2:
// - GET /api/preferences : Retrieve current session's traveller preferences
// - PUT /api/preferences : Upsert (create or update) traveller preferences
// =============================================================================

import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors/error-handler";
import { ApiError } from "@/lib/errors/api-error";
import { resolveRequestId } from "@/lib/request-id";
import { validateRequestOrigin } from "@/lib/auth/csrf";
import { requireSession } from "@/lib/auth/ownership";
import {
  getPreferences,
  upsertPreferences,
} from "@/lib/preferences/preference-service";
import { updatePreferencesSchema } from "@/lib/validation/preferences";

/**
 * GET /api/preferences
 * Returns the preferences for the currently authenticated session.
 */
export async function GET(request: Request) {
  const requestId = resolveRequestId(request);

  try {
    const session = await requireSession(request);
    const preferences = await getPreferences(session.id);

    return NextResponse.json(
      { preferences },
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
 * PUT /api/preferences
 * Creates or updates traveller preferences for the active session.
 */
export async function PUT(request: Request) {
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

    const parseResult = updatePreferencesSchema.safeParse(body);
    if (!parseResult.success) {
      const details = parseResult.error.issues.map((issue) => ({
        field: issue.path.join("."),
        issue: issue.message,
      }));
      throw ApiError.validationError(
        details,
        "Invalid preferences submission. Please review the highlighted fields."
      );
    }

    // 4. Persistence
    const preferences = await upsertPreferences(session.id, parseResult.data);

    return NextResponse.json(
      { preferences },
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


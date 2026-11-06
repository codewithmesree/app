// =============================================================================
// GlobalPay — Session API Endpoints
// =============================================================================
// PRD §17.1, api-contract.md §2:
// - POST   /api/session : Idempotently create or reuse anonymous demo session
// - GET    /api/session : Retrieve current authenticated session
// - DELETE /api/session : Revoke and terminate current demo session
// =============================================================================

import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors/error-handler";
import { ApiError } from "@/lib/errors/api-error";
import { resolveRequestId } from "@/lib/request-id";
import { validateRequestOrigin } from "@/lib/auth/csrf";
import { sessionCreationRateLimiter } from "@/lib/rate-limit/rate-limiter";
import {
  extractSessionTokenFromRequest,
  serializeExpiredSessionCookie,
  serializeSessionCookie,
} from "@/lib/auth/session-token";
import {
  formatSafeSession,
  getOrCreateDemoSession,
  revokeSession,
} from "@/lib/auth/session-service";
import { requireSession } from "@/lib/auth/ownership";

function extractClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "127.0.0.1";
}

/**
 * POST /api/session
 * Establishes an anonymous demo session.
 *
 * IDEMPOTENCY GUARANTEE:
 * If an active, non-expired, non-revoked session cookie is already present,
 * returns the existing session without minting redundant database records.
 */
export async function POST(request: Request) {
  const requestId = resolveRequestId(request);

  try {
    // 1. Validate request origin for anti-CSRF protection
    validateRequestOrigin(request);

    // 2. Enforce abuse-mitigation rate limit on session creation
    const clientIp = extractClientIp(request);
    const rateLimit = sessionCreationRateLimiter.check(clientIp);
    if (!rateLimit.allowed) {
      throw ApiError.rateLimited("Too many session creation requests. Please try again later.");
    }

    // 3. Inspect existing cookie for idempotent reuse
    const existingToken = extractSessionTokenFromRequest(request);
    const { session, rawToken, isNew } = await getOrCreateDemoSession(existingToken);

    // 4. Build response payload (safe summary only, never raw token or tokenHash)
    const responsePayload = {
      session: formatSafeSession(session),
    };

    const headers: Record<string, string> = {
      "x-request-id": requestId,
      "cache-control": "no-store, private",
      "x-ratelimit-limit": String(rateLimit.limit),
      "x-ratelimit-remaining": String(rateLimit.remaining),
    };

    // If a new session was generated, deliver the raw token via HttpOnly cookie
    if (isNew && rawToken) {
      headers["set-cookie"] = serializeSessionCookie(rawToken);
    }

    return NextResponse.json(responsePayload, {
      status: isNew ? 201 : 200,
      headers,
    });
  } catch (error) {
    return handleApiError(error, request, requestId);
  }
}

/**
 * GET /api/session
 * Retrieves the current authenticated demo session.
 * Requires an active, valid session cookie.
 */
export async function GET(request: Request) {
  const requestId = resolveRequestId(request);

  try {
    const session = await requireSession(request);

    return NextResponse.json(
      {
        session: formatSafeSession(session),
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

/**
 * DELETE /api/session
 * Revokes the current demo session and clears the cookie.
 */
export async function DELETE(request: Request) {
  const requestId = resolveRequestId(request);

  try {
    // 1. Anti-CSRF verification
    validateRequestOrigin(request);

    // 2. Extract token and revoke if present
    const rawToken = extractSessionTokenFromRequest(request);
    if (rawToken) {
      await revokeSession(rawToken);
    }

    return NextResponse.json(
      {
        success: true,
        message: "Session ended successfully.",
      },
      {
        status: 200,
        headers: {
          "x-request-id": requestId,
          "cache-control": "no-store, private",
          "set-cookie": serializeExpiredSessionCookie(),
        },
      }
    );
  } catch (error) {
    return handleApiError(error, request, requestId);
  }
}


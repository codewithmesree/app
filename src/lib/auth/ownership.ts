// =============================================================================
// GlobalPay — Server Ownership & Authorization Guards
// =============================================================================
// PRD §17.1, threat-model.md T5, api-contract.md §2:
// Server-derived ownership verification.
// NEVER trust a sessionId or ownerId passed by the client.
// Every protected database query and mutation MUST scope to the session
// resolved on the server from the HttpOnly session cookie.
// =============================================================================

import "server-only";
import { type DemoSession } from "@prisma/client";
import { ApiError } from "../errors/api-error";
import { extractSessionTokenFromRequest } from "./session-token";
import { type DemoSessionWithRelations, resolveSession } from "./session-service";

/**
 * Enforces that a valid, active server session is present on the incoming request.
 * Resolves the token from the cookie, verifies it against the database,
 * and asserts that it has not expired or been revoked.
 *
 * @throws ApiError.unauthenticated if the session is missing, invalid, expired, or revoked.
 */
export async function requireSession(request: Request): Promise<DemoSessionWithRelations> {
  const token = extractSessionTokenFromRequest(request);
  if (!token) {
    throw ApiError.unauthenticated("Session missing. Please establish a demo session.");
  }

  const session = await resolveSession(token);
  if (!session) {
    throw ApiError.unauthenticated("Session is invalid or has expired.");
  }

  return session;
}

/**
 * Optional session resolution for public endpoints with personalized context.
 * Returns null instead of throwing if the session is absent or expired.
 */
export async function getOptionalSession(request: Request): Promise<DemoSessionWithRelations | null> {
  const token = extractSessionTokenFromRequest(request);
  if (!token) {
    return null;
  }
  return resolveSession(token);
}

/**
 * Asserts that a resource's owner sessionId matches the authenticated session's id.
 *
 * SECURITY INVARIANT (Threat Model T5):
 * When an unauthorized session attempts to access another session's resource,
 * emit ApiError.notFound() instead of 403 Forbidden to prevent resource enumeration
 * (i.e. an attacker cannot probe whether an ID exists).
 */
export function assertOwns(session: DemoSession, resourceOwnerSessionId: string): void {
  if (session.id !== resourceOwnerSessionId) {
    throw ApiError.notFound("The requested resource was not found.");
  }
}


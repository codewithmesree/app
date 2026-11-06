// =============================================================================
// GlobalPay — Demo Session Service
// =============================================================================
// PRD §17.1, database-schema.md §4.1:
// Server-only data access for anonymous demo sessions.
// =============================================================================

import "server-only";
import { type BankConnection, type DemoSession, type TravellerPreference } from "@prisma/client";
import { db } from "../db";
import {
  SESSION_MAX_AGE_SECONDS,
  generateSessionToken,
  hashSessionToken,
} from "./session-token";
import { logger } from "../logging/logger";

// Prisma error code for "record not found during update/delete"
const PRISMA_NOT_FOUND_CODE = "P2025";

export type DemoSessionWithRelations = DemoSession & {
  preference: TravellerPreference | null;
  bankConn: BankConnection | null;
};

export interface SafeSessionSummary {
  id: string;
  expiresAt: string;
  hasPreferences: boolean;
  bankStatus: string;
}

/**
 * Resolves a DemoSession record from an incoming raw token.
 * Validates expiration and revocation status.
 *
 * @param rawToken - The raw session token from the cookie.
 * @returns The resolved session with relations, or null if invalid/expired/revoked.
 */
export async function resolveSession(
  rawToken?: string | null
): Promise<DemoSessionWithRelations | null> {
  if (!rawToken || typeof rawToken !== "string" || rawToken.trim().length === 0) {
    return null;
  }

  const tokenHash = hashSessionToken(rawToken);

  const session = await db.demoSession.findUnique({
    where: { tokenHash },
    include: {
      preference: true,
      bankConn: true,
    },
  });

  if (!session) {
    return null;
  }

  const now = new Date();

  // Check revocation
  if (session.revokedAt !== null) {
    return null;
  }

  // Check expiry
  if (session.expiresAt <= now) {
    return null;
  }

  // Fire-and-forget lastSeenAt update (non-blocking).
  // If the record was concurrently deleted (P2025), that is expected during
  // test teardown and can be ignored. Any other error is unexpected and
  // warrants a structured warning so it appears in monitoring without
  // disrupting the authenticated request.
  db.demoSession
    .updateMany({
      where: { id: session.id, revokedAt: null },
      data: { lastSeenAt: now },
    })
    .catch((err: unknown) => {
      const code =
        err instanceof Error && "code" in err
          ? (err as { code?: string }).code
          : undefined;
      if (code !== PRISMA_NOT_FOUND_CODE) {
        logger.warn("lastSeenAt update failed for session", {
          context: { sessionId: session.id },
          error: err,
        });
      }
    });

  return session;
}

/**
 * Creates a brand new DemoSession.
 * Persists the tokenHash in MySQL and returns the un-hashed rawToken
 * strictly to be serialized into the HttpOnly cookie.
 */
export async function createDemoSession(options?: {
  ttlSeconds?: number;
}): Promise<{ session: DemoSessionWithRelations; rawToken: string }> {
  const rawToken = generateSessionToken();
  const tokenHash = hashSessionToken(rawToken);

  const ttl = options?.ttlSeconds ?? SESSION_MAX_AGE_SECONDS;
  const expiresAt = new Date(Date.now() + ttl * 1000);

  const session = await db.demoSession.create({
    data: {
      tokenHash,
      expiresAt,
    },
    include: {
      preference: true,
      bankConn: true,
    },
  });

  logger.info("Created new anonymous demo session", {
    context: { sessionId: session.id, expiresAt: session.expiresAt.toISOString() },
  });

  return { session, rawToken };
}

/**
 * Idempotent session creation/retrieval:
 * If a valid, non-expired, non-revoked session is already associated with the
 * provided token, reuse it rather than creating a duplicate database record.
 * This guarantees onboarding reloads do not mint redundant sessions.
 */
export async function getOrCreateDemoSession(
  existingToken?: string | null
): Promise<{
  session: DemoSessionWithRelations;
  rawToken?: string;
  isNew: boolean;
}> {
  if (existingToken) {
    const existing = await resolveSession(existingToken);
    if (existing) {
      return { session: existing, isNew: false };
    }
  }

  const { session, rawToken } = await createDemoSession();
  return { session, rawToken, isNew: true };
}

/**
 * Revokes a session given its raw token.
 * Sets revokedAt to the current timestamp.
 */
export async function revokeSession(rawToken?: string | null): Promise<boolean> {
  if (!rawToken) {
    return false;
  }

  const tokenHash = hashSessionToken(rawToken);
  const result = await db.demoSession.updateMany({
    where: {
      tokenHash,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  return result.count > 0;
}

/**
 * Formats a safe public representation of a session for API responses.
 * Never exposes tokenHash or database internals.
 */
export function formatSafeSession(session: DemoSessionWithRelations): SafeSessionSummary {
  return {
    id: session.id,
    expiresAt: session.expiresAt.toISOString(),
    hasPreferences: session.preference !== null,
    bankStatus: session.bankConn?.status ?? "NOT_LINKED",
  };
}

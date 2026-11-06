// =============================================================================
// GlobalPay — Session Token & Cookie Utilities
// =============================================================================
// PRD §17.1, Threat Model T5, T6:
//
// 1. HIGH-ENTROPY UNGUESSABLE TOKENS:
//    Session tokens are 32 cryptographically secure random bytes (256 bits of
//    entropy) encoded in URL-safe Base64. Brute-forcing a 256-bit token is
//    computationally infeasible.
//
// 2. HASHED STORAGE & NO TOKEN DISCLOSURE:
//    Only the SHA-256 hex digest of the token is stored in DemoSession.tokenHash.
//    Raw tokens are NEVER stored in the database, NEVER logged, and NEVER
//    returned in JSON API responses.
//
// 3. INDEXED LOOKUP VS TIMING-SAFE COMPARISONS:
//    Note: Database indexed lookup on `tokenHash` (VARCHAR unique index) is an
//    O(1) index search, NOT a constant-time memory comparison. Constant-time
//    comparison is required when comparing secret inputs against fixed secrets
//    of low entropy or known prefixes. For high-entropy (256-bit) cryptographically
//    random tokens, the security guarantee derives from unguessability and hash
//    one-wayness (pre-image resistance).
//
// 4. COOKIE POLICY & THIRD-PARTY REDIRECTS (PAYPAL):
//    SameSite=Lax is used so the session cookie is sent on top-level GET navigations
//    when the buyer is redirected back from PayPal Sandbox (e.g. /pay/return).
//    SameSite=Strict would strip the cookie on cross-site returns.
// =============================================================================

import { createHash, randomBytes } from "node:crypto";

export interface SessionCookieOptions {
  name: string;
  value: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
}

export const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "gp_session";
export const SESSION_MAX_AGE_SECONDS = Number(process.env.SESSION_MAX_AGE_SECONDS) || 86400; // 24 hours

/**
 * Generates a 32-byte cryptographically secure random session token.
 * URL-safe Base64 representation (43 characters).
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Computes the SHA-256 hex digest of a raw session token for storage and lookup.
 * @param rawToken - The raw 256-bit token received from the client cookie.
 */
export function hashSessionToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Builds the standard session cookie descriptor.
 */
export function buildSessionCookieOptions(token: string, maxAge = SESSION_MAX_AGE_SECONDS): SessionCookieOptions {
  return {
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  };
}

/**
 * Formats a Set-Cookie header string with all security attributes.
 */
export function serializeSessionCookie(token: string, maxAge = SESSION_MAX_AGE_SECONDS): string {
  const options = buildSessionCookieOptions(token, maxAge);
  const parts = [
    `${options.name}=${encodeURIComponent(options.value)}`,
    `Path=${options.path}`,
    `Max-Age=${options.maxAge}`,
    "HttpOnly",
    `SameSite=${options.sameSite}`,
  ];

  if (options.secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

/**
 * Formats a Set-Cookie header that expires and clears the session cookie.
 */
export function serializeExpiredSessionCookie(): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "HttpOnly",
    "SameSite=lax",
  ];

  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }

  return parts.join("; ");
}

/**
 * Extracts the raw session token from a Request's Cookie header.
 */
export function extractSessionTokenFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.split("=");
    if (name === SESSION_COOKIE_NAME) {
      const value = rest.join("=");
      return decodeURIComponent(value);
    }
  }

  return null;
}


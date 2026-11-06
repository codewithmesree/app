// =============================================================================
// GlobalPay — Phase 1: Session Management & Ownership Test Suite
// =============================================================================
// Verifies:
// 1. High-entropy token generation & SHA-256 hashing.
// 2. Absence of raw tokens in database.
// 3. Cookie security flags (HttpOnly, SameSite=Lax, Path=/).
// 4. Anti-CSRF origin validation.
// 5. In-memory rate limiting abstraction.
// 6. Server ownership isolation (404 on mismatch).
// 7. Idempotent session creation / reuse.
// 8. Session resolution, expiration, and revocation against Prisma MySQL.
// 9. API route handlers (POST, GET, DELETE /api/session).
// 10. Security verification: cookie attributes, CSRF edge cases, token exposure.
// =============================================================================

/** Minimal shape of ApiError thrown by session guards and route handlers. */
interface ApiErrorShape {
  statusCode: number;
  code: string;
}

import assert from "node:assert/strict";
import test from "node:test";
import {
  generateSessionToken,
  hashSessionToken,
  serializeSessionCookie,
  serializeExpiredSessionCookie,
  extractSessionTokenFromRequest,
  SESSION_COOKIE_NAME,
} from "../../src/lib/auth/session-token";
import { validateRequestOrigin } from "../../src/lib/auth/csrf";
import { InMemoryRateLimiter } from "../../src/lib/rate-limit/rate-limiter";
import { assertOwns } from "../../src/lib/auth/ownership";
import {
  createDemoSession,
  resolveSession,
  getOrCreateDemoSession,
  revokeSession,
  formatSafeSession,
} from "../../src/lib/auth/session-service";
import { db } from "../../src/lib/db";
import { POST, GET, DELETE } from "../../src/app/api/session/route";

// -----------------------------------------------------------------------------
// 1. Token Generation & Hashing Tests
// -----------------------------------------------------------------------------
test("Token generation: produces 256-bit cryptographically secure distinct tokens", () => {
  const token1 = generateSessionToken();
  const token2 = generateSessionToken();

  assert.ok(token1 && token1.length >= 40, "Token should be at least 40 Base64URL characters");
  assert.ok(token2 && token2.length >= 40, "Token should be at least 40 Base64URL characters");
  assert.notEqual(token1, token2, "Subsequent tokens must be unique");
});

test("Token hashing: produces deterministic SHA-256 hex digest and never matches raw token", () => {
  const rawToken = generateSessionToken();
  const hash1 = hashSessionToken(rawToken);
  const hash2 = hashSessionToken(rawToken);

  assert.equal(hash1, hash2, "Hashing must be deterministic");
  assert.match(hash1, /^[a-f0-9]{64}$/, "SHA-256 hash must be 64 lowercase hex characters");
  assert.notEqual(rawToken, hash1, "Raw token must never equal tokenHash");
});

// -----------------------------------------------------------------------------
// 2. Cookie Security Flags Tests
// -----------------------------------------------------------------------------
test("Cookie serialization: includes HttpOnly, SameSite=Lax, and Path=/", () => {
  const rawToken = "test-token-value-12345";
  const cookieHeader = serializeSessionCookie(rawToken, 3600);

  assert.ok(cookieHeader.includes(`${SESSION_COOKIE_NAME}=test-token-value-12345`), "Contains cookie name and value");
  assert.ok(cookieHeader.includes("Path=/"), "Must include Path=/");
  assert.ok(cookieHeader.includes("HttpOnly"), "Must include HttpOnly");
  assert.ok(cookieHeader.includes("SameSite=lax"), "Must include SameSite=lax for PayPal redirect support");
  assert.ok(cookieHeader.includes("Max-Age=3600"), "Must include configured Max-Age");
});

test("Expired cookie serialization: sets Max-Age=0 and 1970 date", () => {
  const expiredCookie = serializeExpiredSessionCookie();

  assert.ok(expiredCookie.includes(`${SESSION_COOKIE_NAME}=`), "Targets session cookie");
  assert.ok(expiredCookie.includes("Max-Age=0"), "Must set Max-Age=0");
  assert.ok(expiredCookie.includes("Expires=Thu, 01 Jan 1970"), "Must set epoch expiration");
  assert.ok(expiredCookie.includes("HttpOnly"), "Must preserve HttpOnly on clear");
});

test("Cookie extraction: parses token correctly from request headers", () => {
  const reqWithCookie = new Request("http://localhost:3000/api/session", {
    headers: {
      cookie: `other_cookie=xyz; ${SESSION_COOKIE_NAME}=my-session-token; tracking=1`,
    },
  });

  const token = extractSessionTokenFromRequest(reqWithCookie);
  assert.equal(token, "my-session-token", "Extracts correct cookie value");

  const reqWithoutCookie = new Request("http://localhost:3000/api/session");
  assert.equal(extractSessionTokenFromRequest(reqWithoutCookie), null, "Returns null when cookie absent");
});

// -----------------------------------------------------------------------------
// 3. CSRF & Origin Validation Tests
// -----------------------------------------------------------------------------
test("CSRF guard: allows safe GET requests without origin headers", () => {
  const getReq = new Request("http://localhost:3000/api/session", { method: "GET" });
  assert.doesNotThrow(() => validateRequestOrigin(getReq));
});

test("CSRF guard: allows same-origin POST requests", () => {
  const postReq = new Request("http://localhost:3000/api/session", {
    method: "POST",
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
    },
  });
  assert.doesNotThrow(() => validateRequestOrigin(postReq));
});

test("CSRF guard: rejects cross-origin POST mutations with 403 Forbidden", () => {
  const evilReq = new Request("http://localhost:3000/api/session", {
    method: "POST",
    headers: {
      host: "localhost:3000",
      origin: "https://attacker.evil.com",
    },
  });

  assert.throws(
    () => validateRequestOrigin(evilReq),
    (err: unknown) =>
      (err as ApiErrorShape).statusCode === 403 &&
      (err as ApiErrorShape).code === "FORBIDDEN"
  );
});

// -----------------------------------------------------------------------------
// 4. Rate Limiting Abstraction Tests
// -----------------------------------------------------------------------------
test("Rate limiter: enforces max requests and decrements remaining quota", () => {
  const limiter = new InMemoryRateLimiter({ windowMs: 1000, maxRequests: 3 });
  const ip = "192.168.1.10";

  const r1 = limiter.check(ip);
  assert.equal(r1.allowed, true);
  assert.equal(r1.remaining, 2);

  const r2 = limiter.check(ip);
  assert.equal(r2.allowed, true);
  assert.equal(r2.remaining, 1);

  const r3 = limiter.check(ip);
  assert.equal(r3.allowed, true);
  assert.equal(r3.remaining, 0);

  const r4 = limiter.check(ip);
  assert.equal(r4.allowed, false, "4th request within window must be rejected");
  assert.equal(r4.remaining, 0);
});

// -----------------------------------------------------------------------------
// 5. Ownership Isolation Tests
// -----------------------------------------------------------------------------
test("Ownership guard: succeeds when session owns the resource", () => {
  const mockSession = { id: "session_abc123" } as unknown as import("@prisma/client").DemoSession;
  assert.doesNotThrow(() => assertOwns(mockSession, "session_abc123"));
});

test("Ownership guard: emits 404 NOT_FOUND on mismatch to prevent ID enumeration", () => {
  const mockSession = { id: "session_userA" } as unknown as import("@prisma/client").DemoSession;
  assert.throws(
    () => assertOwns(mockSession, "session_userB"),
    (err: unknown) =>
      (err as ApiErrorShape).statusCode === 404 &&
      (err as ApiErrorShape).code === "NOT_FOUND"
  );
});

// -----------------------------------------------------------------------------
// 6. Database Integration Tests (MySQL + Prisma)
// -----------------------------------------------------------------------------
test("Database integration: session creation stores only hash, never raw token", async () => {
  const { session, rawToken } = await createDemoSession();

  assert.ok(session.id, "Session must have an ID");
  assert.ok(session.tokenHash, "Session must have tokenHash");
  assert.equal(session.tokenHash, hashSessionToken(rawToken), "Stored hash must match SHA-256 of raw token");

  // Query raw database row directly to verify raw token is nowhere in the record
  const dbRecord = await db.demoSession.findUnique({ where: { id: session.id } });
  assert.ok(dbRecord, "Database record must exist");
  assert.equal(dbRecord.tokenHash, hashSessionToken(rawToken));
  assert.notEqual(JSON.stringify(dbRecord).includes(rawToken), true, "Raw token must NEVER appear in DB record");

  // Safe formatting test
  const safe = formatSafeSession(session);
  assert.equal(safe.id, session.id);
  assert.equal(
    (safe as unknown as Record<string, unknown>).tokenHash,
    undefined,
    "Public representation must never leak tokenHash"
  );
  assert.equal(
    (safe as unknown as Record<string, unknown>).rawToken,
    undefined,
    "Public representation must never leak rawToken"
  );

  // Cleanup
  await db.demoSession.delete({ where: { id: session.id } });
});

test("Database integration: resolveSession verifies active valid token", async () => {
  const { session, rawToken } = await createDemoSession();

  const resolved = await resolveSession(rawToken);
  assert.ok(resolved, "Must resolve valid session");
  assert.equal(resolved.id, session.id, "Resolved session ID must match created session ID");

  // Cleanup
  await db.demoSession.delete({ where: { id: session.id } });
});

test("Database integration: idempotent session creation reuses active session", async () => {
  const { session: firstSession, rawToken } = await createDemoSession();

  // Call getOrCreateDemoSession with the active token (simulating onboarding reload)
  const result = await getOrCreateDemoSession(rawToken);

  assert.equal(result.isNew, false, "Must indicate existing session was reused");
  assert.equal(result.session.id, firstSession.id, "Must return the same session record");
  assert.equal(result.rawToken, undefined, "Does not need to issue a new rawToken");

  // Cleanup
  await db.demoSession.delete({ where: { id: firstSession.id } });
});

test("Database integration: resolveSession rejects revoked session", async () => {
  const { session, rawToken } = await createDemoSession();

  const revoked = await revokeSession(rawToken);
  assert.equal(revoked, true, "Revocation must succeed");

  const resolvedAfterRevoke = await resolveSession(rawToken);
  assert.equal(resolvedAfterRevoke, null, "Revoked session must not resolve");

  // Cleanup
  await db.demoSession.delete({ where: { id: session.id } });
});

test("Database integration: resolveSession rejects expired session", async () => {
  // Create session with negative TTL (already expired)
  const { session, rawToken } = await createDemoSession({ ttlSeconds: -10 });

  const resolvedExpired = await resolveSession(rawToken);
  assert.equal(resolvedExpired, null, "Expired session must not resolve");

  // Cleanup
  await db.demoSession.delete({ where: { id: session.id } });
});

// -----------------------------------------------------------------------------
// 7. Route Handler End-to-End Tests (/api/session)
// -----------------------------------------------------------------------------
test("API route POST /api/session: creates new session with Set-Cookie header", async () => {
  const req = new Request("http://localhost:3000/api/session", {
    method: "POST",
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
    },
  });

  const res = await POST(req);
  assert.equal(res.status, 201, "New session should return 201 Created");

  const setCookie = res.headers.get("set-cookie");
  assert.ok(setCookie, "Must set cookie header");
  assert.ok(setCookie.includes("gp_session="), "Cookie must be gp_session");
  assert.ok(setCookie.includes("HttpOnly"), "Cookie must be HttpOnly");
  assert.ok(setCookie.includes("SameSite=lax"), "Cookie must be SameSite=lax");

  const data = await res.json();
  assert.ok(data.session.id, "Response must include session id");
  assert.equal(
    (data.session as Record<string, unknown>).tokenHash,
    undefined,
    "Response must NEVER include tokenHash"
  );

  // Cleanup
  await db.demoSession.delete({ where: { id: data.session.id } });
});

test("API route POST /api/session: is idempotent when valid cookie is provided", async () => {
  // 1. Create first session
  const { session, rawToken } = await createDemoSession();

  // 2. Make POST with existing cookie
  const req = new Request("http://localhost:3000/api/session", {
    method: "POST",
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
      cookie: `${SESSION_COOKIE_NAME}=${rawToken}`,
    },
  });

  const res = await POST(req);
  assert.equal(res.status, 200, "Reused session should return 200 OK (idempotent)");

  const data = await res.json();
  assert.equal(data.session.id, session.id, "Must return the existing session ID");

  // Cleanup
  await db.demoSession.delete({ where: { id: session.id } });
});

test("API route GET /api/session: returns current session status for valid cookie", async () => {
  const { session, rawToken } = await createDemoSession();

  const req = new Request("http://localhost:3000/api/session", {
    method: "GET",
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${rawToken}`,
    },
  });

  const res = await GET(req);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.equal(data.session.id, session.id);
  assert.equal(data.session.hasPreferences, false);
  assert.equal(data.session.bankStatus, "NOT_LINKED");

  // Cleanup
  await db.demoSession.delete({ where: { id: session.id } });
});

test("API route GET /api/session: returns 401 when cookie is missing", async () => {
  const req = new Request("http://localhost:3000/api/session", {
    method: "GET",
  });

  const res = await GET(req);
  assert.equal(res.status, 401);

  const data = await res.json();
  assert.equal(data.error.code, "UNAUTHENTICATED");
});

test("API route DELETE /api/session: revokes session and expires cookie", async () => {
  const { session, rawToken } = await createDemoSession();

  const req = new Request("http://localhost:3000/api/session", {
    method: "DELETE",
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
      cookie: `${SESSION_COOKIE_NAME}=${rawToken}`,
    },
  });

  const res = await DELETE(req);
  assert.equal(res.status, 200);

  const setCookie = res.headers.get("set-cookie");
  assert.ok(setCookie && setCookie.includes("Max-Age=0"), "Must set Max-Age=0 to clear cookie");

  // Verify DB record is now revoked
  const updated = await db.demoSession.findUnique({ where: { id: session.id } });
  assert.ok(updated?.revokedAt !== null, "DB record must have revokedAt set");

  // Cleanup
  await db.demoSession.delete({ where: { id: session.id } });
});

// =============================================================================
// 8. Security Verification Tests
// =============================================================================

// --- 8a. Cookie attribute correctness ---

test("Security: active cookie does NOT include Secure flag in development (NODE_ENV=test/development)", () => {
  // NODE_ENV is not 'production' in the test runner, so Secure must be absent
  const cookie = serializeSessionCookie("test-token-abc", 3600);
  assert.ok(!cookie.includes("Secure"), "Secure flag must NOT be set outside production");
});

test("Security: expired/clear cookie does NOT include Secure flag in development", () => {
  const cookie = serializeExpiredSessionCookie();
  assert.ok(!cookie.includes("Secure"), "Secure flag must NOT be set outside production");
});

test("Security: active cookie includes Secure flag when NODE_ENV is production", () => {
  const original = process.env.NODE_ENV;
  try {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    const cookie = serializeSessionCookie("test-token-abc", 3600);
    assert.ok(cookie.includes("Secure"), "Secure flag MUST be present in production");
  } finally {
    (process.env as Record<string, string | undefined>).NODE_ENV = original;
  }
});

test("Security: expired/clear cookie includes Secure flag when NODE_ENV is production", () => {
  const original = process.env.NODE_ENV;
  try {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    const cookie = serializeExpiredSessionCookie();
    assert.ok(cookie.includes("Secure"), "Secure flag MUST be present on cookie-clear in production");
    assert.ok(cookie.includes("Max-Age=0"), "Max-Age=0 must be present on cookie-clear");
    assert.ok(cookie.includes("Expires=Thu, 01 Jan 1970"), "Epoch Expires must be present on cookie-clear");
  } finally {
    (process.env as Record<string, string | undefined>).NODE_ENV = original;
  }
});

test("Security: active and expired cookies use the same cookie name", () => {
  const active = serializeSessionCookie("token-xyz", 3600);
  const expired = serializeExpiredSessionCookie();
  // Both must target SESSION_COOKIE_NAME so clearing actually clears the right cookie
  assert.ok(active.startsWith(`${SESSION_COOKIE_NAME}=`), "Active cookie uses SESSION_COOKIE_NAME");
  assert.ok(expired.startsWith(`${SESSION_COOKIE_NAME}=`), "Expired cookie uses SESSION_COOKIE_NAME");
});

// --- 8b. CSRF edge cases ---

test("CSRF: absent Origin and absent Referer is permitted in development (non-blocking)", () => {
  // In development, missing both headers should NOT throw — browsers and curl
  // tools may omit both when calling localhost APIs directly.
  const req = new Request("http://localhost:3000/api/session", {
    method: "POST",
    headers: { host: "localhost:3000" },
  });
  assert.doesNotThrow(
    () => validateRequestOrigin(req),
    "In development: absent Origin+Referer on POST must not throw"
  );
});

test("CSRF: absent Origin and absent Referer is rejected in production", () => {
  const original = process.env.NODE_ENV;
  try {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    const req = new Request("http://localhost:3000/api/session", {
      method: "POST",
      headers: { host: "localhost:3000" },
    });
    assert.throws(
      () => validateRequestOrigin(req),
      (err: unknown) =>
        (err as ApiErrorShape).statusCode === 403 &&
        (err as ApiErrorShape).code === "FORBIDDEN",
      "In production: absent Origin+Referer on POST must be rejected with 403"
    );
  } finally {
    (process.env as Record<string, string | undefined>).NODE_ENV = original;
  }
});

test("CSRF: malformed Origin header is rejected with 403", () => {
  const req = new Request("http://localhost:3000/api/session", {
    method: "POST",
    headers: {
      host: "localhost:3000",
      origin: "not-a-valid-url",
    },
  });
  assert.throws(
    () => validateRequestOrigin(req),
    (err: unknown) =>
      (err as ApiErrorShape).statusCode === 403 &&
      (err as ApiErrorShape).code === "FORBIDDEN",
    "Malformed Origin must be rejected with 403"
  );
});

test("CSRF: malformed Referer header is rejected with 403", () => {
  const req = new Request("http://localhost:3000/api/session", {
    method: "POST",
    headers: {
      host: "localhost:3000",
      referer: "://this-is-not-a-url",
    },
  });
  assert.throws(
    () => validateRequestOrigin(req),
    (err: unknown) =>
      (err as ApiErrorShape).statusCode === 403 &&
      (err as ApiErrorShape).code === "FORBIDDEN",
    "Malformed Referer must be rejected with 403"
  );
});

test("CSRF: cross-origin Referer is rejected with 403", () => {
  const req = new Request("http://localhost:3000/api/session", {
    method: "POST",
    headers: {
      host: "localhost:3000",
      referer: "https://evil.example.com/phishing-page",
    },
  });
  assert.throws(
    () => validateRequestOrigin(req),
    (err: unknown) =>
      (err as ApiErrorShape).statusCode === 403 &&
      (err as ApiErrorShape).code === "FORBIDDEN",
    "Cross-origin Referer must be rejected with 403"
  );
});

test("CSRF: same-origin Referer is accepted when Origin header is absent", () => {
  const req = new Request("http://localhost:3000/api/session", {
    method: "POST",
    headers: {
      host: "localhost:3000",
      referer: "http://localhost:3000/onboarding",
    },
  });
  assert.doesNotThrow(
    () => validateRequestOrigin(req),
    "Same-origin Referer must be accepted when Origin is absent"
  );
});

test("CSRF: origin matches configured NEXT_PUBLIC_APP_URL when Host header is absent", () => {
  const original = process.env.NEXT_PUBLIC_APP_URL;
  try {
    process.env.NEXT_PUBLIC_APP_URL = "http://app.globalpay.example";
    const req = new Request("http://app.globalpay.example/api/session", {
      method: "POST",
      headers: {
        origin: "http://app.globalpay.example",
        // No host header — relies solely on NEXT_PUBLIC_APP_URL
      },
    });
    assert.doesNotThrow(
      () => validateRequestOrigin(req),
      "Origin matching NEXT_PUBLIC_APP_URL must be accepted"
    );
  } finally {
    process.env.NEXT_PUBLIC_APP_URL = original;
  }
});

test("CSRF: PUT and PATCH are also treated as mutating methods", () => {
  for (const method of ["PUT", "PATCH"]) {
    const req = new Request("http://localhost:3000/api/resource", {
      method,
      headers: {
        host: "localhost:3000",
        origin: "https://attacker.evil.com",
      },
    });
    assert.throws(
      () => validateRequestOrigin(req),
      (err: unknown) =>
        (err as ApiErrorShape).statusCode === 403 &&
        (err as ApiErrorShape).code === "FORBIDDEN",
      `${method} with cross-origin must be rejected`
    );
  }
});

// --- 8c. Token / hash exposure in API responses ---

test("Security: POST /api/session response body never contains tokenHash or rawToken fields", async () => {
  const req = new Request("http://localhost:3000/api/session", {
    method: "POST",
    headers: { host: "localhost:3000", origin: "http://localhost:3000" },
  });

  const res = await POST(req);
  const body = await res.json();
  const bodyStr = JSON.stringify(body);

  // tokenHash and rawToken must not appear as keys anywhere in the response
  assert.ok(!bodyStr.includes("tokenHash"), "Response must never expose tokenHash");
  assert.ok(!bodyStr.includes("rawToken"), "Response must never expose rawToken");

  // Cleanup
  await db.demoSession.delete({ where: { id: body.session.id } });
});

test("Security: GET /api/session response body never contains tokenHash or rawToken fields", async () => {
  const { session, rawToken } = await createDemoSession();

  const req = new Request("http://localhost:3000/api/session", {
    method: "GET",
    headers: { cookie: `${SESSION_COOKIE_NAME}=${rawToken}` },
  });

  const res = await GET(req);
  const body = await res.json();
  const bodyStr = JSON.stringify(body);

  assert.ok(!bodyStr.includes("tokenHash"), "GET response must never expose tokenHash");
  assert.ok(!bodyStr.includes("rawToken"), "GET response must never expose rawToken");

  // Cleanup
  await db.demoSession.delete({ where: { id: session.id } });
});

// --- 8d. Rate limiter single-instance documentation ---

test("Security: rate limiter window resets independently per IP key", () => {
  // Verify the fixed-window boundary — different IPs have independent quotas.
  // This also documents that isolation is per-process (single-instance limitation).
  const limiter = new InMemoryRateLimiter({ windowMs: 60_000, maxRequests: 2 });

  const ipA = "10.0.0.1";
  const ipB = "10.0.0.2";

  // Exhaust ipA
  limiter.check(ipA);
  limiter.check(ipA);
  const blockedA = limiter.check(ipA);
  assert.equal(blockedA.allowed, false, "ipA must be rate-limited after quota exhausted");

  // ipB must be independent
  const firstB = limiter.check(ipB);
  assert.equal(firstB.allowed, true, "ipB quota must be independent of ipA — single-instance isolation");
  assert.equal(firstB.remaining, 1);
});

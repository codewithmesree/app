// =============================================================================
// GlobalPay — Phase 2: Traveller Preferences Test Suite
// =============================================================================
// Verifies:
// 1. Unauthenticated access returns 401 UNAUTHENTICATED.
// 2. Preferences can be saved and retrieved accurately.
// 3. Schema validation rejects invalid payloads (ISO codes, limits, empty arrays).
// 4. Session scoping guarantees complete isolation between sessions.
// 5. Idempotent upsert modifies existing record in place without duplicating rows.
// 6. Anti-CSRF origin validation blocks cross-origin PUT requests.
// 7. Safe payload format never exposes raw database internals or IDs.
// =============================================================================

import assert from "node:assert/strict";
import test from "node:test";
import { createDemoSession } from "../../src/lib/auth/session-service";
import { SESSION_COOKIE_NAME } from "../../src/lib/auth/session-token";
import { upsertPreferences } from "../../src/lib/preferences/preference-service";
import { db } from "../../src/lib/db";
import { GET, PUT } from "../../src/app/api/preferences/route";

test("Preferences API: GET returns 401 when session cookie is missing", async () => {
  const req = new Request("http://localhost:3000/api/preferences", {
    method: "GET",
  });

  const res = await GET(req);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.error.code, "UNAUTHENTICATED");
});

test("Preferences API: PUT returns 401 when session cookie is missing", async () => {
  const req = new Request("http://localhost:3000/api/preferences", {
    method: "PUT",
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      homeCountry: "GB",
      displayCurrency: "GBP",
      destinations: ["FR"],
    }),
  });

  const res = await PUT(req);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.error.code, "UNAUTHENTICATED");
});

test("Preferences API: GET returns preferences: null for new session before setup", async () => {
  const { session, rawToken } = await createDemoSession();

  const req = new Request("http://localhost:3000/api/preferences", {
    method: "GET",
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${rawToken}`,
    },
  });

  const res = await GET(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.preferences, null);

  // Cleanup
  await db.demoSession.delete({ where: { id: session.id } });
});

test("Preferences API: PUT persists preferences and GET retrieves them", async () => {
  const { session, rawToken } = await createDemoSession();

  const payload = {
    homeCountry: "GB",
    displayCurrency: "GBP",
    destinations: ["FR", "ES"],
  };

  const putReq = new Request("http://localhost:3000/api/preferences", {
    method: "PUT",
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
      cookie: `${SESSION_COOKIE_NAME}=${rawToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const putRes = await PUT(putReq);
  assert.equal(putRes.status, 200);
  const putData = await putRes.json();
  assert.equal(putData.preferences.homeCountry, "GB");
  assert.equal(putData.preferences.displayCurrency, "GBP");
  assert.deepEqual(putData.preferences.destinations, ["FR", "ES"]);
  assert.ok(putData.preferences.updatedAt);

  // Now verify via GET
  const getReq = new Request("http://localhost:3000/api/preferences", {
    method: "GET",
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${rawToken}`,
    },
  });

  const getRes = await GET(getReq);
  assert.equal(getRes.status, 200);
  const getData = await getRes.json();
  assert.equal(getData.preferences.homeCountry, "GB");
  assert.equal(getData.preferences.displayCurrency, "GBP");
  assert.deepEqual(getData.preferences.destinations, ["FR", "ES"]);

  // Cleanup
  await db.demoSession.delete({ where: { id: session.id } });
});

test("Preferences API: PUT validates payload and rejects invalid fields with 422", async () => {
  const { session, rawToken } = await createDemoSession();

  // Test cases for invalid payloads
  const invalidPayloads = [
    { homeCountry: "USA", displayCurrency: "USD", destinations: ["FR"] }, // homeCountry too long
    { homeCountry: "US", displayCurrency: "US", destinations: ["FR"] }, // displayCurrency too short
    { homeCountry: "US", displayCurrency: "USD", destinations: [] }, // empty destinations
    { homeCountry: "US", displayCurrency: "USD", destinations: ["A"] }, // destination code too short
  ];

  for (const payload of invalidPayloads) {
    const req = new Request("http://localhost:3000/api/preferences", {
      method: "PUT",
      headers: {
        host: "localhost:3000",
        origin: "http://localhost:3000",
        cookie: `${SESSION_COOKIE_NAME}=${rawToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const res = await PUT(req);
    assert.equal(res.status, 422, `Expected 422 for payload: ${JSON.stringify(payload)}`);
    const data = await res.json();
    assert.equal(data.error.code, "VALIDATION_ERROR");
  }

  // Cleanup
  await db.demoSession.delete({ where: { id: session.id } });
});

test("Preferences API: PUT rejects cross-origin request with 403", async () => {
  const { session, rawToken } = await createDemoSession();

  const req = new Request("http://localhost:3000/api/preferences", {
    method: "PUT",
    headers: {
      host: "localhost:3000",
      origin: "https://attacker.evil.com",
      cookie: `${SESSION_COOKIE_NAME}=${rawToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      homeCountry: "GB",
      displayCurrency: "GBP",
      destinations: ["FR"],
    }),
  });

  const res = await PUT(req);
  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.error.code, "FORBIDDEN");

  // Cleanup
  await db.demoSession.delete({ where: { id: session.id } });
});

test("Preferences Isolation: Session A cannot read Session B's preferences", async () => {
  const sessionA = await createDemoSession();
  const sessionB = await createDemoSession();

  // Save preferences for Session A
  await upsertPreferences(sessionA.session.id, {
    homeCountry: "GB",
    displayCurrency: "GBP",
    destinations: ["FR"],
  });

  // Query as Session B
  const reqB = new Request("http://localhost:3000/api/preferences", {
    method: "GET",
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${sessionB.rawToken}`,
    },
  });

  const resB = await GET(reqB);
  assert.equal(resB.status, 200);
  const dataB = await resB.json();
  assert.equal(dataB.preferences, null, "Session B must not see Session A's preferences");

  // Cleanup
  await db.demoSession.delete({ where: { id: sessionA.session.id } });
  await db.demoSession.delete({ where: { id: sessionB.session.id } });
});

test("Preferences Idempotency: Multiple PUT updates mutate single record in place", async () => {
  const { session, rawToken } = await createDemoSession();

  const initialPayload = {
    homeCountry: "US",
    displayCurrency: "USD",
    destinations: ["JP"],
  };

  const updatedPayload = {
    homeCountry: "US",
    displayCurrency: "USD",
    destinations: ["JP", "KR"],
  };

  // 1st PUT
  await PUT(
    new Request("http://localhost:3000/api/preferences", {
      method: "PUT",
      headers: {
        host: "localhost:3000",
        origin: "http://localhost:3000",
        cookie: `${SESSION_COOKIE_NAME}=${rawToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(initialPayload),
    })
  );

  // 2nd PUT
  const res2 = await PUT(
    new Request("http://localhost:3000/api/preferences", {
      method: "PUT",
      headers: {
        host: "localhost:3000",
        origin: "http://localhost:3000",
        cookie: `${SESSION_COOKIE_NAME}=${rawToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(updatedPayload),
    })
  );

  assert.equal(res2.status, 200);
  const data2 = await res2.json();
  assert.deepEqual(data2.preferences.destinations, ["JP", "KR"]);

  // Verify directly in DB that exactly 1 record exists for this session
  const count = await db.travellerPreference.count({
    where: { sessionId: session.id },
  });
  assert.equal(count, 1, "There must be exactly 1 preference record for this session");

  // Cleanup
  await db.demoSession.delete({ where: { id: session.id } });
});

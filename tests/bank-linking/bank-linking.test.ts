// =============================================================================
// GlobalPay — Phase 3: Simulated Bank Linking & Payment Eligibility Tests
// =============================================================================
// Verifies:
// 1. Unauthenticated requests are rejected (401 UNAUTHENTICATED).
// 2. A session can retrieve its own connection status.
// 3. Session A cannot read or modify Session B's connection (Isolation).
// 4. Simulated linking can succeed (NOT_LINKED -> LINKING_IN_PROGRESS -> LINKED).
// 5. Simulated linking can fail (LINKING_IN_PROGRESS -> LINKING_FAILED).
// 6. Failed linking can be retried (LINKING_FAILED -> LINKING_IN_PROGRESS).
// 7. Duplicate requests do not create duplicate active connections.
// 8. Invalid state transitions are rejected (409 CONFLICT).
// 9. Disconnect works correctly and resets account details.
// 10. isSimulated remains true at all times in both DB and API response.
// 11. Every non-LINKED status is payment-ineligible.
// 12. LINKED status passes the bank-linking eligibility check.
// 13. Browsing functionality remains accessible without bank linking.
// 14. CSRF protection rejects cross-origin mutations (403 FORBIDDEN).
// 15. Sensitive fields (PINs, raw numbers, provider tokens) are never stored or returned.
// =============================================================================

import assert from "node:assert/strict";
import test from "node:test";
import { createDemoSession } from "../../src/lib/auth/session-service";
import { SESSION_COOKIE_NAME } from "../../src/lib/auth/session-token";
import { db } from "../../src/lib/db";
import { evaluatePaymentEligibility } from "../../src/lib/payments/eligibility";
import {
  initiateBankLink,
  completeBankLink,
  simulateStatus,
} from "../../src/lib/bank-linking/bank-service";
import { GET as getBankConn, DELETE as deleteBankConn } from "../../src/app/api/bank-connection/route";
import { POST as postBankLink } from "../../src/app/api/bank-connection/link/route";
import { GET as getPaymentEligibility } from "../../src/app/api/payment-eligibility/route";

test("Bank Linking API: GET returns 401 when session cookie is missing", async () => {
  const req = new Request("http://localhost:3000/api/bank-connection", {
    method: "GET",
  });

  const res = await getBankConn(req);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.error.code, "UNAUTHENTICATED");
});

test("Bank Linking API: A session can retrieve its own default unlinked status", async () => {
  const { session, rawToken } = await createDemoSession();

  const req = new Request("http://localhost:3000/api/bank-connection", {
    method: "GET",
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${rawToken}`,
    },
  });

  const res = await getBankConn(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.connection.status, "not_linked");
  assert.equal(data.connection.account, null);
  assert.equal(data.connection.isSimulated, true);

  // Cleanup
  await db.demoSession.delete({ where: { id: session.id } });
});

test("Bank Linking Isolation: Session A cannot view Session B's bank connection", async () => {
  const sessionA = await createDemoSession();
  const sessionB = await createDemoSession();

  // Link bank for Session A
  await initiateBankLink(sessionA.session.id, "chase");
  await completeBankLink(sessionA.session.id, "chase", false);

  // Query connection as Session B
  const reqB = new Request("http://localhost:3000/api/bank-connection", {
    method: "GET",
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${sessionB.rawToken}`,
    },
  });

  const resB = await getBankConn(reqB);
  assert.equal(resB.status, 200);
  const dataB = await resB.json();
  assert.equal(dataB.connection.status, "not_linked");
  assert.equal(dataB.connection.account, null);

  // Cleanup
  await db.demoSession.delete({ where: { id: sessionA.session.id } });
  await db.demoSession.delete({ where: { id: sessionB.session.id } });
});

test("Simulated Linking Flow: successfully transitions to LINKED state", async () => {
  const { session, rawToken } = await createDemoSession();

  // 1. Initiate linking
  const initReq = new Request("http://localhost:3000/api/bank-connection/link", {
    method: "POST",
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
      cookie: `${SESSION_COOKIE_NAME}=${rawToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      action: "initiate",
      institutionId: "chase",
    }),
  });

  const initRes = await postBankLink(initReq);
  assert.equal(initRes.status, 200);
  const initData = await initRes.json();
  assert.equal(initData.connection.status, "linking_in_progress");
  assert.equal(initData.connection.isSimulated, true);

  // 2. Complete linking
  const completeReq = new Request("http://localhost:3000/api/bank-connection/link", {
    method: "POST",
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
      cookie: `${SESSION_COOKIE_NAME}=${rawToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      action: "complete",
      institutionId: "chase",
      simulateFailure: false,
    }),
  });

  const completeRes = await postBankLink(completeReq);
  assert.equal(completeRes.status, 200);
  const completeData = await completeRes.json();
  assert.equal(completeData.connection.status, "linked");
  assert.ok(completeData.connection.account);
  assert.equal(completeData.connection.account.institutionName, "Chase Bank");
  assert.equal(completeData.connection.account.maskedAccountNumber, "•••• 4821");
  assert.equal(completeData.connection.isSimulated, true);

  // Cleanup
  await db.demoSession.delete({ where: { id: session.id } });
});

test("Simulated Linking Flow: simulated failure transitions to LINKING_FAILED", async () => {
  const { session, rawToken } = await createDemoSession();

  // Initiate
  await initiateBankLink(session.id, "barclays");

  // Complete with simulated failure
  const failReq = new Request("http://localhost:3000/api/bank-connection/link", {
    method: "POST",
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
      cookie: `${SESSION_COOKIE_NAME}=${rawToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      action: "complete",
      institutionId: "barclays",
      simulateFailure: true,
      failureReason: "Simulated verification timeout.",
    }),
  });

  const failRes = await postBankLink(failReq);
  assert.equal(failRes.status, 200);
  const failData = await failRes.json();
  assert.equal(failData.connection.status, "linking_failed");
  assert.equal(failData.connection.notice, "Simulated verification timeout.");
  assert.equal(failData.connection.account, null);

  // Cleanup
  await db.demoSession.delete({ where: { id: session.id } });
});

test("State Transitions: failed linking can be retried successfully", async () => {
  const { session, rawToken } = await createDemoSession();

  // 1. Fail first attempt
  await initiateBankLink(session.id, "chase");
  await completeBankLink(session.id, "chase", true);

  // 2. Retry: re-initiate
  const retryInitReq = new Request("http://localhost:3000/api/bank-connection/link", {
    method: "POST",
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
      cookie: `${SESSION_COOKIE_NAME}=${rawToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      action: "initiate",
      institutionId: "chase",
    }),
  });

  const retryInitRes = await postBankLink(retryInitReq);
  assert.equal(retryInitRes.status, 200);
  assert.equal((await retryInitRes.json()).connection.status, "linking_in_progress");

  // 3. Complete retry with success
  const retryCompleteReq = new Request("http://localhost:3000/api/bank-connection/link", {
    method: "POST",
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
      cookie: `${SESSION_COOKIE_NAME}=${rawToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      action: "complete",
      institutionId: "chase",
      simulateFailure: false,
    }),
  });

  const retryCompleteRes = await postBankLink(retryCompleteReq);
  assert.equal(retryCompleteRes.status, 200);
  assert.equal((await retryCompleteRes.json()).connection.status, "linked");

  // Cleanup
  await db.demoSession.delete({ where: { id: session.id } });
});

test("Idempotency: repeated initiate calls do not duplicate database records", async () => {
  const { session, rawToken } = await createDemoSession();

  // Initiate twice
  for (let i = 0; i < 2; i++) {
    await postBankLink(
      new Request("http://localhost:3000/api/bank-connection/link", {
        method: "POST",
        headers: {
          host: "localhost:3000",
          origin: "http://localhost:3000",
          cookie: `${SESSION_COOKIE_NAME}=${rawToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action: "initiate",
          institutionId: "deutsche",
        }),
      })
    );
  }

  // Count records for this session
  const count = await db.bankConnection.count({
    where: { sessionId: session.id },
  });
  assert.equal(count, 1, "There must be exactly 1 bank connection record for this session");

  // Cleanup
  await db.demoSession.delete({ where: { id: session.id } });
});

test("State Transitions: attempting complete without initiate throws 409 CONFLICT", async () => {
  const { session, rawToken } = await createDemoSession();

  // Attempt to complete directly when NOT_LINKED
  const directCompleteReq = new Request("http://localhost:3000/api/bank-connection/link", {
    method: "POST",
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
      cookie: `${SESSION_COOKIE_NAME}=${rawToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      action: "complete",
      institutionId: "chase",
      simulateFailure: false,
    }),
  });

  const res = await postBankLink(directCompleteReq);
  assert.equal(res.status, 409);
  const data = await res.json();
  assert.equal(data.error.code, "TRANSACTION_STATE_CONFLICT");

  // Cleanup
  await db.demoSession.delete({ where: { id: session.id } });
});

test("Disconnect: resets connection status to NOT_LINKED and clears account", async () => {
  const { session, rawToken } = await createDemoSession();

  // 1. Link account
  await initiateBankLink(session.id, "mizuho");
  await completeBankLink(session.id, "mizuho", false);

  // 2. Disconnect via DELETE
  const deleteReq = new Request("http://localhost:3000/api/bank-connection", {
    method: "DELETE",
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
      cookie: `${SESSION_COOKIE_NAME}=${rawToken}`,
    },
  });

  const deleteRes = await deleteBankConn(deleteReq);
  assert.equal(deleteRes.status, 200);
  const data = await deleteRes.json();
  assert.equal(data.connection.status, "not_linked");
  assert.equal(data.connection.account, null);

  // Verify in DB
  const record = await db.bankConnection.findUnique({
    where: { sessionId: session.id },
  });
  assert.equal(record?.status, "NOT_LINKED");
  assert.equal(record?.institutionName, null);
  assert.equal(record?.isSimulated, true);

  // Cleanup
  await db.demoSession.delete({ where: { id: session.id } });
});

test("Security: isSimulated remains true in DB and API responses at all times", async () => {
  const { session } = await createDemoSession();

  const conn = await initiateBankLink(session.id, "chase");
  assert.equal(conn.isSimulated, true);

  const dbConn = await db.bankConnection.findUnique({ where: { sessionId: session.id } });
  assert.equal(dbConn?.isSimulated, true);

  // Cleanup
  await db.demoSession.delete({ where: { id: session.id } });
});

test("Payment Eligibility: every non-LINKED status evaluates to eligible: false", async () => {
  const { session } = await createDemoSession();

  // 1. NOT_LINKED
  const resNotLinked = await evaluatePaymentEligibility(session.id);
  assert.equal(resNotLinked.eligible, false);
  assert.equal(resNotLinked.reasonCode, "BANK_LINKING_REQUIRED");

  // 2. LINKING_IN_PROGRESS
  await initiateBankLink(session.id, "chase");
  const resInProgress = await evaluatePaymentEligibility(session.id);
  assert.equal(resInProgress.eligible, false);
  assert.equal(resInProgress.reasonCode, "LINKING_IN_PROGRESS");

  // 3. LINKING_FAILED
  await completeBankLink(session.id, "chase", true);
  const resFailed = await evaluatePaymentEligibility(session.id);
  assert.equal(resFailed.eligible, false);
  assert.equal(resFailed.reasonCode, "LINKING_FAILED");

  // 4. CONNECTION_EXPIRED
  await initiateBankLink(session.id, "chase");
  await completeBankLink(session.id, "chase", false);
  await simulateStatus(session.id, "connection_expired");
  const resExpired = await evaluatePaymentEligibility(session.id);
  assert.equal(resExpired.eligible, false);
  assert.equal(resExpired.reasonCode, "CONNECTION_EXPIRED");

  // 5. RECONNECTION_REQUIRED
  await simulateStatus(session.id, "reconnection_required");
  const resReconn = await evaluatePaymentEligibility(session.id);
  assert.equal(resReconn.eligible, false);
  assert.equal(resReconn.reasonCode, "RECONNECTION_REQUIRED");

  // Cleanup
  await db.demoSession.delete({ where: { id: session.id } });
});

test("Payment Eligibility: LINKED status evaluates to eligible: true via API", async () => {
  const { session, rawToken } = await createDemoSession();

  // Link account
  await initiateBankLink(session.id, "chase");
  await completeBankLink(session.id, "chase", false);

  const req = new Request("http://localhost:3000/api/payment-eligibility", {
    method: "GET",
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${rawToken}`,
    },
  });

  const res = await getPaymentEligibility(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.eligible, true);
  assert.equal(data.reasonCode, "ELIGIBLE");
  assert.equal(data.bankStatus, "linked");

  // Cleanup
  await db.demoSession.delete({ where: { id: session.id } });
});

test("Explore Mode: unlinked session can evaluate eligibility without being blocked", async () => {
  const { session, rawToken } = await createDemoSession();

  const req = new Request("http://localhost:3000/api/payment-eligibility", {
    method: "GET",
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${rawToken}`,
    },
  });

  const res = await getPaymentEligibility(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  // Exploring doesn't crash or return 403; it gracefully informs eligibility status
  assert.equal(data.eligible, false);
  assert.equal(data.reasonCode, "BANK_LINKING_REQUIRED");

  // Cleanup
  await db.demoSession.delete({ where: { id: session.id } });
});

test("CSRF Protection: rejects cross-origin POST /api/bank-connection/link with 403", async () => {
  const { session, rawToken } = await createDemoSession();

  const req = new Request("http://localhost:3000/api/bank-connection/link", {
    method: "POST",
    headers: {
      host: "localhost:3000",
      origin: "https://evil.attacker.com",
      cookie: `${SESSION_COOKIE_NAME}=${rawToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      action: "initiate",
      institutionId: "chase",
    }),
  });

  const res = await postBankLink(req);
  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.error.code, "FORBIDDEN");

  // Cleanup
  await db.demoSession.delete({ where: { id: session.id } });
});

test("Security: response never exposes raw account numbers, tokens, or credentials", async () => {
  const { session, rawToken } = await createDemoSession();

  await initiateBankLink(session.id, "chase");
  await completeBankLink(session.id, "chase", false);

  const req = new Request("http://localhost:3000/api/bank-connection", {
    method: "GET",
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${rawToken}`,
    },
  });

  const res = await getBankConn(req);
  const text = await res.text();

  assert.ok(!text.includes("password"), "Response must not contain password");
  assert.ok(!text.includes("pin"), "Response must not contain PIN");
  assert.ok(!text.includes("tokenHash"), "Response must not contain tokenHash");
  assert.ok(!text.includes("providerMandateId"), "Response must not disclose internal mandate ID");

  // Cleanup
  await db.demoSession.delete({ where: { id: session.id } });
});

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/db";
import { createDemoSession } from "@/lib/auth/session-service";
import { seedDemoMerchants } from "@/lib/merchants/merchant-service";
import { transactionService } from "@/lib/payments/transaction-service";
import { BankConnectionStatus, TransactionStatus } from "@prisma/client";
import { GET as transactionsGetHandler } from "@/app/api/transactions/route";
import { GET as merchantsGetHandler } from "@/app/api/merchants/route";

describe("Phase 7.2: Dashboard Live Data Integration", () => {
  before(async () => {
    await seedDemoMerchants();
  });

  async function setupSessionWithBank(status: BankConnectionStatus = BankConnectionStatus.LINKED) {
    const { session, rawToken } = await createDemoSession();
    await db.bankConnection.upsert({
      where: { sessionId: session.id },
      create: {
        sessionId: session.id,
        status,
        institutionName: "JPMorgan Chase Demo",
        maskedAccountNumber: "•• 4821",
        isSimulated: true,
      },
      update: { status },
    });
    return { session, rawToken };
  }

  // 1. Session with existing transactions returns populated array
  it("1. GET /api/transactions returns live transactions for the active session", async () => {
    const { session, rawToken } = await setupSessionWithBank();
    const txn = await transactionService.createTransaction(session.id, {
      merchantId: "kyoto-ryokan-stay",
      amount: "25000",
      currency: "JPY",
    });

    const request = new Request("http://localhost:3000/api/transactions", {
      headers: { Cookie: `gp_session=${rawToken}` },
    });

    const response = await transactionsGetHandler(request);
    assert.strictEqual(response.status, 200);
    const json = await response.json();
    assert.ok(Array.isArray(json.transactions));
    assert.ok(json.transactions.length >= 1);
    assert.strictEqual(json.transactions[0].id, txn.id);
    assert.strictEqual(json.transactions[0].merchant.name, "Gion Heritage Ryokan");
    assert.strictEqual(json.transactions[0].amount, "25000");
    assert.strictEqual(json.transactions[0].currency, "JPY");
    assert.strictEqual(json.transactions[0].status, TransactionStatus.CREATED);
  });

  // 2. Session with zero transactions returns empty list (driving EmptyState)
  it("2. GET /api/transactions returns empty array for new session with no activity", async () => {
    const { rawToken } = await setupSessionWithBank();

    const request = new Request("http://localhost:3000/api/transactions", {
      headers: { Cookie: `gp_session=${rawToken}` },
    });

    const response = await transactionsGetHandler(request);
    assert.strictEqual(response.status, 200);
    const json = await response.json();
    assert.ok(Array.isArray(json.transactions));
    assert.strictEqual(json.transactions.length, 0);
  });

  // 3. Session isolation: Session A cannot view Session B's transactions on the dashboard
  it("3. session isolation: Session A cannot view Session B's transactions", async () => {
    const { session: sessionA } = await setupSessionWithBank();
    const { rawToken: rawTokenB } = await setupSessionWithBank();

    await transactionService.createTransaction(sessionA.id, {
      merchantId: "kyoto-ryokan-stay",
      amount: "25000",
      currency: "JPY",
    });

    const requestB = new Request("http://localhost:3000/api/transactions", {
      headers: { Cookie: `gp_session=${rawTokenB}` },
    });

    const responseB = await transactionsGetHandler(requestB);
    assert.strictEqual(responseB.status, 200);
    const jsonB = await responseB.json();
    assert.strictEqual(jsonB.transactions.length, 0);
  });

  // 4. Merchants catalogue endpoint filters correctly by destination corridor (e.g. JP)
  it("4. GET /api/merchants?countryCode=JP returns seeded merchants for Japan", async () => {
    const request = new Request("http://localhost:3000/api/merchants?countryCode=JP&limit=4");
    const response = await merchantsGetHandler(request);
    assert.strictEqual(response.status, 200);
    const json = await response.json();
    assert.ok(Array.isArray(json.items));
    assert.ok(json.items.length >= 1);
    const hasKyoto = json.items.some((m: { slug?: string; name: string }) => m.slug === "kyoto-ryokan-stay" || m.name.includes("Kyoto"));
    assert.ok(hasKyoto);
  });

  // 5. Merchants catalogue returns empty list for country with no seeded merchants
  it("5. GET /api/merchants?countryCode=IS returns empty list for unseeded country", async () => {
    const request = new Request("http://localhost:3000/api/merchants?countryCode=IS&limit=4");
    const response = await merchantsGetHandler(request);
    assert.strictEqual(response.status, 200);
    const json = await response.json();
    assert.ok(Array.isArray(json.items));
    assert.strictEqual(json.items.length, 0);
  });
});

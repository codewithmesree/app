// =============================================================================
// GlobalPay — Phase 4: Merchant Catalogue & Discovery Tests
// =============================================================================
// Verifies:
// 1. Merchant catalogue seeding is idempotent.
// 2. Listing merchants returns valid paginated results.
// 3. Country filtering returns matching merchants only.
// 4. Category filtering returns matching merchants only.
// 5. Combined filtering matches expected subset.
// 6. Detail retrieval by CUID ID.
// 7. Detail retrieval by unique slug.
// 8. Inactive merchants are hidden from discovery and return 404 on detail lookup.
// 9. Invalid query parameters return 422 VALIDATION_ERROR.
// 10. Explore mode accessibility: merchants can be listed without a session.
// =============================================================================

import assert from "node:assert/strict";
import test from "node:test";
import { db } from "../../src/lib/db";
import {
  DEMO_MERCHANTS_SEED_DATA,
  seedDemoMerchants,
  listMerchants,
} from "../../src/lib/merchants/merchant-service";
import { GET as getMerchantsList } from "../../src/app/api/merchants/route";
import { GET as getMerchantDetail } from "../../src/app/api/merchants/[id]/route";

test("Merchant Seeding: is idempotent and creates consistent row count", async () => {
  const count1 = await seedDemoMerchants();
  assert.ok(count1 >= 15, "Initial seed should create at least 15 merchants");

  const totalInDb = await db.merchant.count({
    where: { slug: { in: DEMO_MERCHANTS_SEED_DATA.map(({ slug }) => slug) } },
  });
  assert.equal(totalInDb, count1);

  // Run seed second time — must not create duplicate rows
  const count2 = await seedDemoMerchants();
  assert.equal(count2, count1);

  const totalAfterSecondSeed = await db.merchant.count({
    where: { slug: { in: DEMO_MERCHANTS_SEED_DATA.map(({ slug }) => slug) } },
  });
  assert.equal(totalAfterSecondSeed, totalInDb, "Total count in DB must remain identical");
});

test("Merchant Discovery API: GET /api/merchants returns active catalogue", async () => {
  await seedDemoMerchants();

  const req = new Request("http://localhost:3000/api/merchants");
  const res = await getMerchantsList(req);

  assert.equal(res.status, 200);
  const data = await res.json();

  assert.ok(Array.isArray(data.items), "Items should be an array");
  assert.ok(data.items.length >= 15, "Should return seeded merchants");

  const sample = data.items[0];
  assert.ok(sample.id);
  assert.ok(sample.slug);
  assert.ok(sample.name);
  assert.ok(sample.category);
  assert.equal(sample.isDemo, true);
  assert.ok(sample.demoQrIdentifier, "Demo merchant summaries expose their QR identifier");
});

test("Merchant Filtering: countryCode query parameter filters accurately", async () => {
  await seedDemoMerchants();

  const req = new Request("http://localhost:3000/api/merchants?countryCode=JP");
  const res = await getMerchantsList(req);

  assert.equal(res.status, 200);
  const data = await res.json();

  assert.ok(data.items.length > 0);
  for (const item of data.items) {
    assert.equal(item.countryCode, "JP", "All items must be in JP");
  }
});

test("Merchant Filtering: category query parameter filters accurately", async () => {
  await seedDemoMerchants();

  const req = new Request("http://localhost:3000/api/merchants?category=dining");
  const res = await getMerchantsList(req);

  assert.equal(res.status, 200);
  const data = await res.json();

  assert.ok(data.items.length > 0);
  for (const item of data.items) {
    assert.equal(item.category, "dining", "All items must be dining");
  }
});

test("Merchant Filtering: combined countryCode and category filters", async () => {
  await seedDemoMerchants();

  const req = new Request("http://localhost:3000/api/merchants?countryCode=GB&category=transit");
  const res = await getMerchantsList(req);

  assert.equal(res.status, 200);
  const data = await res.json();

  assert.equal(data.items.length, 1);
  assert.equal(data.items[0].slug, "london-underground-tfl");
  assert.equal(data.items[0].countryCode, "GB");
  assert.equal(data.items[0].category, "transit");
});

test("Merchant Detail API: lookup by unique slug succeeds", async () => {
  await seedDemoMerchants();

  const req = new Request("http://localhost:3000/api/merchants/tokyo-metro-transit");
  const res = await getMerchantDetail(req, {
    params: Promise.resolve({ id: "tokyo-metro-transit" }),
  });

  assert.equal(res.status, 200);
  const data = await res.json();

  assert.equal(data.merchant.slug, "tokyo-metro-transit");
  assert.equal(data.merchant.name, "Tokyo Metro Pass Kiosk");
  assert.equal(data.merchant.countryCode, "JP");
  assert.equal(data.merchant.demoQrIdentifier, "qr_demo_jp_metro_01");
});

test("Merchant Detail API: lookup by CUID ID succeeds", async () => {
  await seedDemoMerchants();

  const sample = await db.merchant.findUnique({
    where: { slug: "nyc-mta-omny" },
  });
  assert.ok(sample);

  const req = new Request(`http://localhost:3000/api/merchants/${sample.id}`);
  const res = await getMerchantDetail(req, {
    params: Promise.resolve({ id: sample.id }),
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.merchant.id, sample.id);
  assert.equal(data.merchant.slug, "nyc-mta-omny");
});

test("Inactive Merchants: omitted from listing and return 404 on detail lookup", async () => {
  // Create an inactive merchant
  const inactiveSlug = `test-inactive-${Date.now()}`;
  const inactiveMerchant = await db.merchant.create({
    data: {
      slug: inactiveSlug,
      name: "Inactive Test Merchant",
      category: "retail",
      countryCode: "US",
      displayCurrency: "USD",
      supportedMethods: ["PAYPAL_SANDBOX"],
      isDemo: true,
      isActive: false, // Inactive!
    },
  });

  // 1. Should not appear in list
  const list = await listMerchants({ countryCode: "US", limit: 50 });
  const foundInList = list.items.some((m) => m.slug === inactiveSlug);
  assert.equal(foundInList, false, "Inactive merchant must be omitted from list");

  // 2. Detail lookup by slug must return 404
  const req = new Request(`http://localhost:3000/api/merchants/${inactiveSlug}`);
  const res = await getMerchantDetail(req, {
    params: Promise.resolve({ id: inactiveSlug }),
  });

  assert.equal(res.status, 404);
  const data = await res.json();
  assert.equal(data.error.code, "NOT_FOUND");

  // Cleanup
  await db.merchant.delete({ where: { id: inactiveMerchant.id } });
});

test("Validation Error: invalid query parameters return 422", async () => {
  // Invalid 3-letter country code (must be 2-letter ISO)
  const req = new Request("http://localhost:3000/api/merchants?countryCode=USA");
  const res = await getMerchantsList(req);

  assert.equal(res.status, 422);
  const data = await res.json();
  assert.equal(data.error.code, "VALIDATION_ERROR");
});

test("Explore Mode: unauthenticated user can explore merchants freely", async () => {
  // No Cookie header supplied
  const req = new Request("http://localhost:3000/api/merchants");
  const res = await getMerchantsList(req);

  assert.equal(res.status, 200, "Explore mode must be public and unauthenticated");
  const data = await res.json();
  assert.ok(data.items.length > 0);
});

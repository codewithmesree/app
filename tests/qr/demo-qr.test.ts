import assert from "node:assert/strict";
import test from "node:test";
import { db } from "../../src/lib/db";
import {
  getMerchantPaymentHref,
  isDemoQrIdentifier,
} from "../../src/lib/qr/demo-qr";
import {
  DEMO_MERCHANTS_SEED_DATA,
  seedDemoMerchants,
} from "../../src/lib/merchants/merchant-service";
import { GET as getMerchantsList } from "../../src/app/api/merchants/route";
import { GET as getDemoQrMerchant } from "../../src/app/api/merchants/demo-qr/[identifier]/route";

test("GlobalPay demo QR identifiers accept only the documented format", () => {
  for (const merchant of DEMO_MERCHANTS_SEED_DATA) {
    assert.equal(isDemoQrIdentifier(merchant.demoQrIdentifier), true);
  }
  assert.equal(isDemoQrIdentifier("qr_demo_jp_metro_01"), true);
  assert.equal(isDemoQrIdentifier("qr_demo_us_dining_01"), true);
  assert.equal(isDemoQrIdentifier("https://example.com"), false);
  assert.equal(isDemoQrIdentifier("qr_demo_jp_metro"), false);
  assert.equal(isDemoQrIdentifier("qr_demo_JP_metro_01"), false);
  assert.equal(isDemoQrIdentifier(`qr_demo_jp_${"x".repeat(70)}_01`), false);
});

test("A seeded demo QR resolves to the corresponding active catalogue merchant", async () => {
  await seedDemoMerchants();
  const identifier = "qr_demo_jp_metro_01";
  const seededMerchant = await db.merchant.findUnique({
    where: { slug: "tokyo-metro-transit" },
  });
  assert.ok(seededMerchant);

  const response = await getDemoQrMerchant(
    new Request(`http://localhost:3000/api/merchants/demo-qr/${identifier}`),
    { params: Promise.resolve({ identifier }) }
  );
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.merchant.id, seededMerchant.id);
  assert.equal(data.merchant.name, "Tokyo Metro Pass Kiosk");
  assert.equal(data.merchant.displayCurrency, "JPY");
});

test("Resolving a seeded demo QR does not create a transaction", async () => {
  await seedDemoMerchants();
  const identifier = "qr_demo_jp_metro_01";
  const merchant = await db.merchant.findUnique({
    where: { slug: "tokyo-metro-transit" },
  });
  assert.ok(merchant);

  const transactionsBefore = await db.transaction.count({
    where: { merchantId: merchant.id },
  });
  const response = await getDemoQrMerchant(
    new Request(`http://localhost:3000/api/merchants/demo-qr/${identifier}`),
    { params: Promise.resolve({ identifier }) }
  );
  const data = await response.json();
  const transactionsAfter = await db.transaction.count({
    where: { merchantId: merchant.id },
  });

  assert.equal(response.status, 200);
  assert.equal(data.merchant.id, merchant.id);
  assert.equal(data.merchant.demoQrIdentifier, identifier);
  assert.equal(data.merchant.isActive, true);
  assert.equal(data.merchant.isDemo, true);
  assert.equal(transactionsAfter, transactionsBefore);
  assert.equal(getMerchantPaymentHref(data.merchant.id), `/pay?merchantId=${merchant.id}`);
});

test("QR catalogue excludes active demo merchants that are not in the seeded set", async () => {
  const suffix = Date.now();
  const merchant = await db.merchant.create({
    data: {
      slug: `qr-unseeded-${suffix}`,
      name: "Unseeded QR Test Merchant",
      category: "retail",
      countryCode: "US",
      displayCurrency: "USD",
      supportedMethods: ["PAYPAL_SANDBOX"],
      demoQrIdentifier: `qr_demo_us_unseeded_${String(suffix).slice(-2)}`,
      isDemo: true,
      isActive: true,
    },
  });

  try {
    const response = await getMerchantsList(
      new Request("http://localhost:3000/api/merchants?countryCode=US&demoQrOnly=true&limit=50")
    );
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(
      data.items.some((item: { id: string }) => item.id === merchant.id),
      false
    );
  } finally {
    await db.merchant.delete({ where: { id: merchant.id } });
  }
});

test("Invalid and unknown demo QR identifiers are rejected", async () => {
  const invalidIdentifier = "https://example.com";
  const invalidResponse = await getDemoQrMerchant(
    new Request("http://localhost:3000/api/merchants/demo-qr/https%3A%2F%2Fexample.com"),
    { params: Promise.resolve({ identifier: invalidIdentifier }) }
  );
  assert.equal(invalidResponse.status, 422);

  const unknownIdentifier = "qr_demo_us_unknown_99";
  const unknownResponse = await getDemoQrMerchant(
    new Request(`http://localhost:3000/api/merchants/demo-qr/${unknownIdentifier}`),
    { params: Promise.resolve({ identifier: unknownIdentifier }) }
  );
  assert.equal(unknownResponse.status, 404);
});

test("Inactive demo merchants cannot be resolved from their QR identifier", async () => {
  const suffix = Date.now();
  const identifier = `qr_demo_us_inactive_${String(suffix).slice(-2)}`;
  const testSeed = {
    slug: `qr-inactive-${suffix}`,
    name: "Inactive QR Test Merchant",
    category: "retail",
    description: "Test-only merchant seed.",
    countryCode: "US",
    displayCurrency: "USD",
    demoAmount: "1.00",
    supportedMethods: ["PAYPAL_SANDBOX"],
    demoQrIdentifier: identifier,
    isDemo: true,
    isActive: false,
  };
  DEMO_MERCHANTS_SEED_DATA.push(testSeed);
  let merchantId: string | null = null;

  try {
    const merchant = await db.merchant.create({
      data: {
        slug: testSeed.slug,
        name: testSeed.name,
        category: testSeed.category,
        description: testSeed.description,
        countryCode: testSeed.countryCode,
        displayCurrency: testSeed.displayCurrency,
        supportedMethods: testSeed.supportedMethods,
        demoQrIdentifier: testSeed.demoQrIdentifier,
        isDemo: testSeed.isDemo,
        isActive: testSeed.isActive,
      },
    });
    merchantId = merchant.id;
    const response = await getDemoQrMerchant(
      new Request(`http://localhost:3000/api/merchants/demo-qr/${identifier}`),
      { params: Promise.resolve({ identifier }) }
    );
    assert.equal(response.status, 404);
  } finally {
    if (merchantId) {
      await db.merchant.delete({ where: { id: merchantId } });
    }
    const testSeedIndex = DEMO_MERCHANTS_SEED_DATA.indexOf(testSeed);
    if (testSeedIndex !== -1) DEMO_MERCHANTS_SEED_DATA.splice(testSeedIndex, 1);
  }
});

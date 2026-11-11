import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { QuoteService } from "@/lib/fx/quote-service";
import { fxRateCache } from "@/lib/fx/fx-cache";
import { type FxProvider, type FxRatesResult } from "@/lib/fx/fx-provider";
import { quoteRequestSchema } from "@/lib/validation/currency";
import { db } from "@/lib/db";
import { POST as quotePostHandler } from "@/app/api/currency/quote/route";
import { GET as supportedCurrenciesGetHandler } from "@/app/api/quotes/supported-currencies/route";
import { ApiError } from "@/lib/errors/api-error";

class MockFxProvider implements FxProvider {
  public name = "mock/ecb";
  public calls = 0;
  public shouldFail = false;
  public failError = new Error("Provider network failure");

  async fetchRates(): Promise<FxRatesResult> {
    this.calls++;
    if (this.shouldFail) {
      throw this.failError;
    }

    const rates = new Map<string, string>();
    // Base EUR
    rates.set("EUR:EUR", "1.000000000000");
    rates.set("EUR:USD", "1.085000000000");
    rates.set("EUR:GBP", "0.855000000000");
    rates.set("EUR:JPY", "165.200000000000");
    rates.set("EUR:SGD", "1.452000000000");
    rates.set("EUR:INR", "90.500000000000");

    // Cross rates (example subset: JPY to INR)
    // 1 JPY = 90.50 / 165.20 = 0.547820823244 INR
    rates.set("JPY:INR", "0.547820823244");
    rates.set("INR:JPY", "1.825414364640");
    rates.set("INR:USD", "0.011988950276");
    rates.set("USD:INR", "83.410138248847");
    rates.set("USD:JPY", "152.258064516129");
    rates.set("JPY:USD", "0.006567796610");

    return {
      source: this.name,
      asOf: new Date("2026-11-08T00:00:00.000Z"),
      rates,
    };
  }
}

describe("Phase 5: Currency Quote Service, FX Conversion & Caching", () => {
  let mockProvider: MockFxProvider;
  let testService: QuoteService;

  beforeEach(() => {
    fxRateCache.clear();
    mockProvider = new MockFxProvider();
    testService = new QuoteService(mockProvider);
  });

  // 1. Supported currency validation
  it("1. returns supported currencies list with metadata", () => {
    const list = testService.getSupportedCurrencies();
    assert.strictEqual(list.length, 6);
    const codes = list.map((c) => c.code);
    assert.deepStrictEqual(codes, ["INR", "JPY", "GBP", "EUR", "SGD", "USD"]);
  });

  // 2. Unsupported currency rejection
  it("2. rejects unsupported currencies with 422 UNSUPPORTED_CURRENCY", async () => {
    await assert.rejects(
      async () => {
        await testService.getQuote("100.00", "ABC", "USD");
      },
      (err: unknown) => {
        return err instanceof ApiError && err.statusCode === 422 && err.code === "UNSUPPORTED_CURRENCY";
      }
    );
  });

  // 3. Correct quote direction
  it("3. validates quote direction: JPY -> INR returns INR per 1 JPY", async () => {
    const quote = await testService.getQuote("1000", "JPY", "INR");
    assert.strictEqual(quote.baseCurrency, "JPY");
    assert.strictEqual(quote.convertedCurrency, "INR");
    assert.strictEqual(quote.rate, "0.547820823244");
    // 1000 * 0.547820823244 = 547.82 INR
    assert.strictEqual(quote.convertedAmount, "547.82");
  });

  // 4. Conversion calculations (BigInt, not float)
  it("4. performs accurate conversion calculations without floating-point artifacts", async () => {
    const quote = await testService.getQuote("100.00", "USD", "INR");
    assert.strictEqual(quote.baseCurrency, "USD");
    assert.strictEqual(quote.convertedCurrency, "INR");
    assert.strictEqual(quote.convertedAmount, "8341.01");
  });

  // 5. Decimal precision and currency rounding (JPY to 0 decimals)
  it("5. rounds JPY converted amounts to 0 decimal places", async () => {
    const quote = await testService.getQuote("10.00", "USD", "JPY");
    assert.strictEqual(quote.convertedCurrency, "JPY");
    // 10 * 152.258064516129 = 1523 JPY
    assert.strictEqual(quote.convertedAmount, "1523");
  });

  // 6. Decimal precision and currency rounding (EUR/GBP/SGD/USD/INR to 2 decimals)
  it("6. rounds standard currencies to 2 decimal places", async () => {
    const quote = await testService.getQuote("100.00", "INR", "USD");
    assert.strictEqual(quote.convertedCurrency, "USD");
    assert.strictEqual(quote.convertedAmount, "1.20");
  });

  // 7. Invalid amount rejection (zero amount)
  it("7. rejects zero amount in validation schema", () => {
    const res = quoteRequestSchema.safeParse({
      baseAmount: "0.00",
      baseCurrency: "USD",
      quoteCurrency: "INR",
    });
    assert.strictEqual(res.success, false);
  });

  // 8. Invalid amount rejection (negative amount)
  it("8. rejects negative amount in validation schema", () => {
    const res = quoteRequestSchema.safeParse({
      baseAmount: "-50.00",
      baseCurrency: "USD",
      quoteCurrency: "INR",
    });
    assert.strictEqual(res.success, false);
  });

  // 9. Invalid amount rejection (amount exceeding max whole digits)
  it("9. rejects amount exceeding max whole digits (9)", () => {
    const res = quoteRequestSchema.safeParse({
      baseAmount: "1000000000.00", // 10 whole digits
      baseCurrency: "USD",
      quoteCurrency: "INR",
    });
    assert.strictEqual(res.success, false);
  });

  // 10. Cache hit returns cached rates without provider call
  it("10. cache hit returns rates without re-invoking provider", async () => {
    await testService.getQuote("10.00", "USD", "INR");
    assert.strictEqual(mockProvider.calls, 1);

    await testService.getQuote("20.00", "USD", "INR");
    assert.strictEqual(mockProvider.calls, 1); // No new call!
  });

  // 11. Cache miss triggers provider fetch and populates cache
  it("11. cache miss triggers provider fetch and populates cache", async () => {
    fxRateCache.clear();
    assert.strictEqual(fxRateCache.get(), null);
    await testService.getQuote("10.00", "USD", "INR");
    assert.strictEqual(mockProvider.calls, 1);
    assert.notStrictEqual(fxRateCache.get(), null);
  });

  // 12. Expired cache triggers provider re-fetch
  it("12. expired cache triggers provider re-fetch", async () => {
    await testService.getQuote("10.00", "USD", "INR");
    assert.strictEqual(mockProvider.calls, 1);

    // Artificially expire the cache by setting its expiry in the past
    const cached = fxRateCache.get();
    assert.notStrictEqual(cached, null);
    // Mutate internal cached timestamp to simulate expiry
    (fxRateCache as unknown as { cached: { expiresAt: number } }).cached.expiresAt = Date.now() - 1000;

    await testService.getQuote("10.00", "USD", "INR");
    assert.strictEqual(mockProvider.calls, 2); // Fetched fresh rates!
  });

  // 13. Stale-rate behavior when provider fails within stale window
  it("13. returns stale rates with stale: true flag when provider fails within stale window", async () => {
    await testService.getQuote("10.00", "USD", "INR");
    assert.strictEqual(mockProvider.calls, 1);

    // Simulate expired rate and failing provider
    const internalCache = fxRateCache as unknown as { cached: { expiresAt: number; maxStaleUntil: number } };
    internalCache.cached.expiresAt = Date.now() - 1000;
    internalCache.cached.maxStaleUntil = Date.now() + 600000;
    mockProvider.shouldFail = true;

    const staleQuote = await testService.getQuote("10.00", "USD", "INR");
    assert.strictEqual(staleQuote.stale, true);
    assert.strictEqual(staleQuote.rate, "83.410138248847");
  });

  // 14. Provider rate-limit response (429) fallback
  it("14. handles provider rate-limit (429) gracefully with stale fallback", async () => {
    await testService.getQuote("10.00", "USD", "INR");
    const internalCache = fxRateCache as unknown as { cached: { expiresAt: number; maxStaleUntil: number } };
    internalCache.cached.expiresAt = Date.now() - 1000;
    internalCache.cached.maxStaleUntil = Date.now() + 600000;

    mockProvider.shouldFail = true;
    mockProvider.failError = new Error("FX_PROVIDER_HTTP_429");

    const quote = await testService.getQuote("10.00", "USD", "INR");
    assert.strictEqual(quote.stale, true);
  });

  // 15. Malformed provider response rejected
  it("15. rejects malformed provider response and falls back to safe error if no cache", async () => {
    fxRateCache.clear();
    mockProvider.shouldFail = true;
    mockProvider.failError = new Error("FX_PROVIDER_MALFORMED_PAYLOAD");

    await assert.rejects(
      async () => {
        await testService.getQuote("10.00", "USD", "INR");
      },
      (err: unknown) => {
        return err instanceof ApiError && err.statusCode === 503 && err.code === "QUOTE_UNAVAILABLE";
      }
    );
  });

  // 16. No usable rate returns 503 QUOTE_UNAVAILABLE
  it("16. returns 503 QUOTE_UNAVAILABLE when provider fails and no cache exists", async () => {
    fxRateCache.clear();
    mockProvider.shouldFail = true;

    await assert.rejects(
      async () => {
        await testService.getQuote("10.00", "USD", "INR");
      },
      (err: unknown) => err instanceof ApiError && err.statusCode === 503 && err.code === "QUOTE_UNAVAILABLE"
    );
  });

  // 17. Database persistence: CurrencyQuote record created on fetch
  it("17. persists CurrencyQuote snapshot to database", async () => {
    const quote = await testService.getQuote("50.00", "USD", "INR");
    assert.ok(quote.id, "Quote should have a persisted DB ID");

    const record = await db.currencyQuote.findUnique({
      where: { id: quote.id },
    });
    assert.ok(record, "Record should exist in database");
    assert.strictEqual(record?.baseCurrency, "USD");
    assert.strictEqual(record?.quoteCurrency, "INR");
    assert.strictEqual(record?.isIndicative, true);
  });

  // 18. Historical quote snapshot immutability
  it("18. preserves historical quote snapshot immutability on subsequent quotes", async () => {
    const firstQuote = await testService.getQuote("25.00", "USD", "INR");
    const secondQuote = await testService.getQuote("75.00", "USD", "INR");

    assert.notStrictEqual(firstQuote.id, secondQuote.id);

    const firstRecord = await db.currencyQuote.findUnique({
      where: { id: firstQuote.id },
    });
    assert.strictEqual(firstRecord?.baseAmount.toString(), "25");
  });

  // API Route Tests
  describe("API Endpoints", () => {
    it("POST /api/currency/quote returns 200 with quote envelope", async () => {
      const request = new Request("http://localhost:3000/api/currency/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseAmount: "100.00",
          baseCurrency: "USD",
          quoteCurrency: "INR",
        }),
      });

      const response = await quotePostHandler(request);
      assert.strictEqual(response.status, 200);

      const json = await response.json();
      assert.ok(json.quote);
      assert.strictEqual(json.quote.baseCurrency, "USD");
      assert.strictEqual(json.quote.convertedCurrency, "INR");
      assert.strictEqual(json.quote.indicative, true);
      assert.ok(json.disclaimer);
    });

    it("GET /api/quotes/supported-currencies returns 200 with cache headers", async () => {
      const request = new Request("http://localhost:3000/api/quotes/supported-currencies");
      const response = await supportedCurrenciesGetHandler(request);
      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.headers.get("cache-control"), "public, max-age=3600");

      const json = await response.json();
      assert.ok(Array.isArray(json.currencies));
      assert.strictEqual(json.currencies.length, 6);
    });
  });
});


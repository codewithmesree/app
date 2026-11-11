// =============================================================================
// GlobalPay — Frankfurter FX Provider
// =============================================================================
// PRD §7.4, architecture.md §10:
// Implementation of FxProvider using Frankfurter (ECB rates).
// EUR is the primary base; all cross-currency rates are calculated using BigInt.
// =============================================================================

import "server-only";
import { z } from "zod";
import { multiplyAndDivide, trimDecimal } from "@/lib/currency/decimal";
import { logger } from "@/lib/logging/logger";
import { getFxConfig } from "../fx-config";
import {
  type FxProvider,
  type FxRatesResult,
  SUPPORTED_FX_CURRENCIES,
  type SupportedFxCurrency,
} from "../fx-provider";

const frankfurterResponseSchema = z.object({
  amount: z.number(),
  base: z.string(),
  date: z.string(),
  rates: z.record(z.string(), z.number()),
});

export class FrankfurterProvider implements FxProvider {
  public readonly name = "frankfurter/ecb";

  async fetchRates(): Promise<FxRatesResult> {
    const config = getFxConfig();
    const symbols = SUPPORTED_FX_CURRENCIES.filter((c: string) => c !== "EUR").join(",");
    const url = `${config.baseUrl}/latest?base=EUR&symbols=${symbols}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "GlobalPay-FX/1.0",
        },
        signal: controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timer);
      const isAbort = err instanceof Error && err.name === "AbortError";
      logger.error(isAbort ? "Frankfurter provider request timed out" : "Frankfurter provider network error", {
        context: { url, error: String(err) },
      });
      throw new Error(isAbort ? "FX_PROVIDER_TIMEOUT" : "FX_PROVIDER_NETWORK_ERROR");
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      logger.error("Frankfurter provider returned non-200 status", {
        context: { status: response.status, statusText: response.statusText },
      });
      throw new Error(`FX_PROVIDER_HTTP_${response.status}`);
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch (err) {
      logger.error("Frankfurter provider returned invalid JSON", { context: { error: String(err) } });
      throw new Error("FX_PROVIDER_MALFORMED_JSON");
    }

    const parseResult = frankfurterResponseSchema.safeParse(json);
    if (!parseResult.success) {
      logger.error("Frankfurter provider payload validation failed", {
        context: { issues: parseResult.error.issues },
      });
      throw new Error("FX_PROVIDER_MALFORMED_PAYLOAD");
    }

    const data = parseResult.data;
    const asOf = new Date(data.date);
    if (Number.isNaN(asOf.getTime())) {
      throw new Error("FX_PROVIDER_INVALID_DATE");
    }

    // Convert raw numeric rates into normalized decimal strings per 1 EUR
    const eurRates = new Map<SupportedFxCurrency, string>();
    eurRates.set("EUR", "1.000000000000");

    for (const currency of SUPPORTED_FX_CURRENCIES) {
      if (currency === "EUR") continue;
      const rateNum = data.rates[currency];
      if (typeof rateNum !== "number" || rateNum <= 0 || !Number.isFinite(rateNum)) {
        throw new Error(`FX_PROVIDER_MISSING_CURRENCY_${currency}`);
      }
      eurRates.set(currency, rateNum.toFixed(8));
    }

    // Derive all cross rates: rate(A -> B) = rate(EUR -> B) / rate(EUR -> A)
    const allRates = new Map<string, string>();

    for (const base of SUPPORTED_FX_CURRENCIES) {
      for (const quote of SUPPORTED_FX_CURRENCIES) {
        if (base === quote) {
          allRates.set(`${base}:${quote}`, "1.000000000000");
          continue;
        }

        const rateEurToBase = eurRates.get(base)!;
        const rateEurToQuote = eurRates.get(quote)!;

        // rate(base -> quote) = (1 * rateEurToQuote) / rateEurToBase
        const crossRate = trimDecimal(
          multiplyAndDivide("1", rateEurToQuote, rateEurToBase, 12),
          6
        );
        allRates.set(`${base}:${quote}`, crossRate);
      }
    }

    return {
      source: this.name,
      asOf,
      rates: allRates,
    };
  }
}

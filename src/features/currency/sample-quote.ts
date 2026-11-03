import { multiplyAndDivide, trimDecimal } from "@/lib/currency/decimal";
import { getCurrency, type CurrencyCode } from "./currencies";
import type { CurrencyQuote } from "./currency-types";

/**
 * MOCK DATA, isolated here on purpose. These fixed values are not market rates
 * and no provider is called. Replace this module with a client for
 * POST /api/currency/quote once the currency service exists.
 */
const SAMPLE_UNITS_PER_USD: Record<CurrencyCode, string> = {
  USD: "1",
  EUR: "0.9241",
  GBP: "0.7892",
  JPY: "154.20",
  CHF: "0.8998",
  AUD: "1.5230",
  CAD: "1.3700",
  SGD: "1.3500",
  AED: "3.6725",
  THB: "36.85",
  INR: "83.10",
};

const SAMPLE_SOURCE = "Sample fixture, not a market rate";
const SAMPLE_AS_OF = "2026-10-31T12:00:00.000Z";

export function getSampleRate(base: CurrencyCode, quote: CurrencyCode): string {
  return trimDecimal(multiplyAndDivide("1", SAMPLE_UNITS_PER_USD[quote], SAMPLE_UNITS_PER_USD[base], 6));
}

export function getSampleQuote(baseAmount: string, baseCurrency: CurrencyCode, quoteCurrency: CurrencyCode): CurrencyQuote {
  return {
    baseAmount,
    baseCurrency,
    convertedAmount: multiplyAndDivide(
      baseAmount,
      SAMPLE_UNITS_PER_USD[quoteCurrency],
      SAMPLE_UNITS_PER_USD[baseCurrency],
      getCurrency(quoteCurrency).decimals,
    ),
    convertedCurrency: quoteCurrency,
    rate: getSampleRate(baseCurrency, quoteCurrency),
    source: SAMPLE_SOURCE,
    asOf: SAMPLE_AS_OF,
    indicative: true,
  };
}

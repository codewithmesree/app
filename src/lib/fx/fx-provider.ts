// =============================================================================
// GlobalPay — FX Provider Abstraction
// =============================================================================
// PRD §7.4, architecture.md §10:
// Pluggable server-side exchange rate provider interface.
// =============================================================================

import "server-only";

export const SUPPORTED_FX_CURRENCIES = ["INR", "JPY", "GBP", "EUR", "SGD", "USD"] as const;
export type SupportedFxCurrency = (typeof SUPPORTED_FX_CURRENCIES)[number];

export function isSupportedFxCurrency(code: string): code is SupportedFxCurrency {
  return (SUPPORTED_FX_CURRENCIES as readonly string[]).includes(code.toUpperCase());
}

export interface FxRateObservation {
  baseCurrency: SupportedFxCurrency;
  quoteCurrency: SupportedFxCurrency;
  /** High precision rate string (B per 1 unit of A) */
  rate: string;
  source: string;
  asOf: Date;
}

export interface FxRatesResult {
  source: string;
  asOf: Date;
  /** Map of "BASE:QUOTE" -> rate string (e.g. "EUR:USD" -> "1.0850") */
  rates: Map<string, string>;
}

export interface FxProvider {
  name: string;
  /**
   * Fetches the latest exchange rates for all supported currencies.
   * Cross rates must be resolved so any supported pair can be looked up.
   */
  fetchRates(): Promise<FxRatesResult>;
}


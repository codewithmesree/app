/** Shape of `quote` from POST /api/currency/quote (api-contract.md section 6). */
export type CurrencyQuote = {
  baseAmount: string;
  baseCurrency: string;
  convertedAmount: string;
  convertedCurrency: string;
  rate: string;
  source: string;
  asOf: string;
  indicative: true;
};

export type RateStatus = "loading" | "unavailable" | "ready";

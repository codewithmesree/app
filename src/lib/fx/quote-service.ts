// =============================================================================
// GlobalPay — FX Quote Service
// =============================================================================
// PRD §7.4, api-contract.md §6, database-schema.md §4.2:
// Server-only indicative currency quote service with caching and DB snapshotting.
// =============================================================================

import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "../db";
import { ApiError } from "../errors/api-error";
import { logger } from "../logging/logger";
import { multiplyAndDivide, trimDecimal } from "../currency/decimal";
import { getCurrency } from "@/features/currency/currencies";
import { getFxConfig } from "./fx-config";
import {
  type FxProvider,
  type FxRatesResult,
  SUPPORTED_FX_CURRENCIES,
  isSupportedFxCurrency,
} from "./fx-provider";
import { FrankfurterProvider } from "./providers/frankfurter";
import { fxRateCache } from "./fx-cache";

export interface IndicativeQuoteResult {
  id: string;
  baseAmount: string;
  baseCurrency: string;
  convertedAmount: string;
  convertedCurrency: string;
  rate: string;
  source: string;
  asOf: string;
  expiresAt: string;
  indicative: true;
  stale: boolean;
}

export interface SupportedCurrencyMetadata {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
}

export class QuoteService {
  constructor(private provider: FxProvider = new FrankfurterProvider()) {}

  /**
   * Retrieves supported currencies and display metadata.
   */
  getSupportedCurrencies(): SupportedCurrencyMetadata[] {
    return SUPPORTED_FX_CURRENCIES.map((code) => {
      const meta = getCurrency(code);
      return {
        code: meta.code,
        name: meta.name,
        symbol: meta.symbol,
        decimals: meta.decimals,
      };
    });
  }

  /**
   * Resolves the latest exchange rate set, leveraging cache, stale fallback,
   * or performing a fresh provider fetch.
   */
  async resolveRates(): Promise<{ ratesResult: FxRatesResult; isStale: boolean }> {
    const cached = fxRateCache.get();
    if (cached && !cached.isStale) {
      return cached;
    }

    // Try fetching fresh rates
    try {
      const freshRates = await this.provider.fetchRates();
      fxRateCache.set(freshRates);
      return { ratesResult: freshRates, isStale: false };
    } catch (fetchErr) {
      logger.warn("Failed to fetch fresh FX rates from provider", {
        context: { provider: this.provider.name, error: String(fetchErr) },
      });

      // If we have stale cached rates within the allowable stale window, use them
      if (cached && cached.isStale) {
        logger.warn("Falling back to stale FX rates within allowable grace window", {
          context: { asOf: cached.ratesResult.asOf.toISOString() },
        });
        return cached;
      }

      // No usable rates available
      throw new ApiError({
        statusCode: 503,
        code: "QUOTE_UNAVAILABLE",
        message: "Indicative exchange rates are temporarily unavailable. Please try again later.",
      });
    }
  }

  /**
   * Generates an indicative quote for a base amount, base currency, and quote currency.
   * Persists a CurrencyQuote record in MySQL asynchronously/immutably.
   */
  async getQuote(
    baseAmount: string,
    baseCurrencyInput: string,
    quoteCurrencyInput: string
  ): Promise<IndicativeQuoteResult> {
    const baseCurrency = baseCurrencyInput.toUpperCase();
    const quoteCurrency = quoteCurrencyInput.toUpperCase();

    if (!isSupportedFxCurrency(baseCurrency)) {
      throw new ApiError({
        statusCode: 422,
        code: "UNSUPPORTED_CURRENCY",
        message: `Base currency '${baseCurrency}' is not supported for indicative conversion.`,
      });
    }

    if (!isSupportedFxCurrency(quoteCurrency)) {
      throw new ApiError({
        statusCode: 422,
        code: "UNSUPPORTED_CURRENCY",
        message: `Quote currency '${quoteCurrency}' is not supported for indicative conversion.`,
      });
    }

    if (baseCurrency === quoteCurrency) {
      throw ApiError.badRequest("Base and quote currency must be different.");
    }

    const { ratesResult, isStale } = await this.resolveRates();
    const pairKey = `${baseCurrency}:${quoteCurrency}`;
    const rate = ratesResult.rates.get(pairKey);

    if (!rate) {
      logger.error("Rate missing from provider result for supported pair", {
        context: { pair: pairKey, provider: ratesResult.source },
      });
      throw new ApiError({
        statusCode: 503,
        code: "QUOTE_UNAVAILABLE",
        message: "Exchange rate for requested currency pair is unavailable.",
      });
    }

    // Calculate converted amount with natural decimals of quote currency
    const quoteMeta = getCurrency(quoteCurrency);
    // convertedAmount = baseAmount * rate / 1
    const convertedAmount = multiplyAndDivide(baseAmount, rate, "1", quoteMeta.decimals);

    const config = getFxConfig();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + config.cacheTtlSeconds * 1000);

    // Persist immutable CurrencyQuote snapshot in the database
    let persistedId: string | undefined;
    try {
      const quoteRecord = await db.currencyQuote.create({
        data: {
          baseAmount: new Prisma.Decimal(baseAmount),
          baseCurrency,
          convertedAmount: new Prisma.Decimal(convertedAmount),
          quoteCurrency,
          rate: new Prisma.Decimal(rate),
          source: ratesResult.source,
          asOf: ratesResult.asOf,
          expiresAt,
          isIndicative: true,
        },
      });
      persistedId = quoteRecord.id;
    } catch (dbErr) {
      logger.error("Failed to persist CurrencyQuote snapshot to database", {
        error: dbErr,
      });
      throw new ApiError({
        statusCode: 503,
        code: "QUOTE_UNAVAILABLE",
        message: "The indicative quote could not be saved. Please try again.",
      });
    }

    if (!persistedId) {
      throw new ApiError({
        statusCode: 503,
        code: "QUOTE_UNAVAILABLE",
        message: "The indicative quote could not be saved. Please try again.",
      });
    }

    return {
      id: persistedId,
      baseAmount,
      baseCurrency,
      convertedAmount,
      convertedCurrency: quoteCurrency,
      rate: trimDecimal(rate, 4),
      source: ratesResult.source,
      asOf: ratesResult.asOf.toISOString(),
      expiresAt: expiresAt.toISOString(),
      indicative: true,
      stale: isStale,
    };
  }
}

export const quoteService = new QuoteService();

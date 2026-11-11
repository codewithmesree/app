// =============================================================================
// GlobalPay — FX In-Memory Cache
// =============================================================================
// PRD §7.4, architecture.md §10:
// Rate caching abstraction with TTL expiry, stale fallback, and mutex for refresh.
// Documented limitation: single-instance in-memory cache.
// =============================================================================

import "server-only";
import { type FxRatesResult } from "./fx-provider";
import { getFxConfig } from "./fx-config";

export interface CachedRateData {
  ratesResult: FxRatesResult;
  retrievedAt: number;
  expiresAt: number;
  maxStaleUntil: number;
}

export interface CacheLookupResult {
  ratesResult: FxRatesResult;
  isStale: boolean;
}

export interface RateCache {
  get(): CacheLookupResult | null;
  set(result: FxRatesResult): void;
  clear(): void;
}

class InMemoryRateCache implements RateCache {
  private cached: CachedRateData | null = null;
  private pendingRefresh: Promise<FxRatesResult> | null = null;

  get(): CacheLookupResult | null {
    if (!this.cached) {
      return null;
    }

    const now = Date.now();
    if (now <= this.cached.expiresAt) {
      return { ratesResult: this.cached.ratesResult, isStale: false };
    }

    if (now <= this.cached.maxStaleUntil) {
      return { ratesResult: this.cached.ratesResult, isStale: true };
    }

    // Beyond max stale window
    return null;
  }

  set(result: FxRatesResult): void {
    const config = getFxConfig();
    const now = Date.now();
    this.cached = {
      ratesResult: result,
      retrievedAt: now,
      expiresAt: now + config.cacheTtlSeconds * 1000,
      maxStaleUntil: now + config.maxStaleSeconds * 1000,
    };
  }

  clear(): void {
    this.cached = null;
    this.pendingRefresh = null;
  }

  getPendingRefresh(): Promise<FxRatesResult> | null {
    return this.pendingRefresh;
  }

  setPendingRefresh(promise: Promise<FxRatesResult> | null): void {
    this.pendingRefresh = promise;
  }
}

export const fxRateCache = new InMemoryRateCache();


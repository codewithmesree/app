// =============================================================================
// GlobalPay — FX Environment Configuration
// =============================================================================
// PRD §7.4, architecture.md §10:
// Server-only configuration for indicative foreign-exchange quote service.
// =============================================================================

import "server-only";

export interface FxConfig {
  provider: "frankfurter" | "open-exchange-rates";
  apiKey: string;
  baseUrl: string;
  cacheTtlSeconds: number;
  maxStaleSeconds: number;
  requestTimeoutMs: number;
}

export function getFxConfig(): FxConfig {
  const provider = (process.env.FX_PROVIDER || "frankfurter") as FxConfig["provider"];
  const apiKey = process.env.FX_API_KEY || "";
  const baseUrl = process.env.FX_BASE_URL || "https://api.frankfurter.app";
  const parsedTtl = parseInt(process.env.FX_CACHE_TTL_SECONDS || "300", 10);
  const cacheTtlSeconds = Number.isFinite(parsedTtl) && parsedTtl > 0 ? parsedTtl : 300;
  
  // Stale rates are permitted up to 2x TTL window when provider is unreachable
  const maxStaleSeconds = cacheTtlSeconds * 2;
  const requestTimeoutMs = 8000;

  return {
    provider,
    apiKey,
    baseUrl: baseUrl.replace(/\/+$/, ""),
    cacheTtlSeconds,
    maxStaleSeconds,
    requestTimeoutMs,
  };
}


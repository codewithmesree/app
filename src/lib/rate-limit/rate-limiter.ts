// =============================================================================
// GlobalPay — Rate Limiting Abstraction
// =============================================================================
// Provides rate-limiting interfaces and a default development in-memory
// implementation.
//
// PRODUCTION NOTE / LIMITATION:
// The InMemoryRateLimiter is designed for single-process development.
// In multi-instance or serverless deployments (such as Vercel Edge/Serverless,
// multi-pod Kubernetes, or scaled Node processes), memory is not shared across
// workers/isolates. For production deployments with multiple instances,
// swap this backend with a distributed store such as Redis (e.g. @upstash/ratelimit).
// =============================================================================

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number; // Unix timestamp in milliseconds
}

export interface RateLimiter {
  check(key: string): Promise<RateLimitResult> | RateLimitResult;
}

interface WindowBucket {
  count: number;
  resetAt: number;
}

/**
 * In-memory fixed-window rate limiter.
 * Suitable for local development and single-instance demonstrations.
 */
export class InMemoryRateLimiter implements RateLimiter {
  private buckets = new Map<string, WindowBucket>();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(options: { windowMs: number; maxRequests: number }) {
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;

    // Periodic sweep every 5 minutes to prevent memory leaks from inactive keys
    if (typeof setInterval !== "undefined") {
      const timer = setInterval(() => this.cleanup(), 5 * 60 * 1000);
      if (typeof timer.unref === "function") {
        timer.unref();
      }
    }
  }

  check(key: string): RateLimitResult {
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || now >= bucket.resetAt) {
      const resetAt = now + this.windowMs;
      this.buckets.set(key, { count: 1, resetAt });
      return {
        allowed: true,
        limit: this.maxRequests,
        remaining: this.maxRequests - 1,
        resetAt,
      };
    }

    if (bucket.count < this.maxRequests) {
      bucket.count += 1;
      return {
        allowed: true,
        limit: this.maxRequests,
        remaining: this.maxRequests - bucket.count,
        resetAt: bucket.resetAt,
      };
    }

    return {
      allowed: false,
      limit: this.maxRequests,
      remaining: 0,
      resetAt: bucket.resetAt,
    };
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, bucket] of this.buckets.entries()) {
      if (now >= bucket.resetAt) {
        this.buckets.delete(key);
      }
    }
  }

  // Exposed for automated testing
  reset(): void {
    this.buckets.clear();
  }
}

/**
 * Pre-configured rate limiter for anonymous session creation:
 * Allows up to 10 session creations per client IP per 5 minutes.
 */
export const sessionCreationRateLimiter = new InMemoryRateLimiter({
  windowMs: 5 * 60 * 1000,
  maxRequests: 10,
});


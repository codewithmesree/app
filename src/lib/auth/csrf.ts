// =============================================================================
// GlobalPay — Origin & CSRF Protection
// =============================================================================
// Threat Model T12: Cross-site request forgery and origin handling.
// Guards mutating endpoints against unauthorized cross-origin requests.
// =============================================================================

import { ApiError } from "../errors/api-error";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Validates that mutating requests originate from the expected host or app URL.
 * Throws ApiError.forbidden if a cross-origin mutation is detected.
 */
export function validateRequestOrigin(request: Request): void {
  if (!MUTATING_METHODS.has(request.method.toUpperCase())) {
    return;
  }

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("host");

  // 1. If Origin header is present, check against current Host or configured App URL
  if (origin) {
    try {
      const originUrl = new URL(origin);
      if (host && originUrl.host === host) {
        return;
      }

      const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL;
      if (configuredAppUrl) {
        const expectedUrl = new URL(configuredAppUrl);
        if (originUrl.host === expectedUrl.host) {
          return;
        }
      }
    } catch {
      throw ApiError.forbidden("Malformed request origin.");
    }

    throw ApiError.forbidden("Cross-origin request rejected.");
  }

  // 2. Fallback to Referer header if Origin was omitted (e.g. same-origin GET/POST navigations in some browsers)
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (host && refererUrl.host === host) {
        return;
      }

      const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL;
      if (configuredAppUrl) {
        const expectedUrl = new URL(configuredAppUrl);
        if (refererUrl.host === expectedUrl.host) {
          return;
        }
      }
    } catch {
      throw ApiError.forbidden("Malformed request referer.");
    }

    throw ApiError.forbidden("Cross-origin request rejected.");
  }

  // In production, reject mutating requests lacking both Origin and Referer headers
  if (process.env.NODE_ENV === "production") {
    throw ApiError.forbidden("Request origin verification required.");
  }
}


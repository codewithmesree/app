import { randomUUID } from "node:crypto";

/**
 * Generates an opaque request identifier with the standard prefix.
 * e.g. "req_7a8b9c0d1e2f3a4b"
 */
export function generateRequestId(): string {
  const raw = randomUUID().replace(/-/g, "");
  return `req_${raw.slice(0, 16)}`;
}

/**
 * Extracts the X-Request-ID header from a Request if present and safe,
 * or generates a new one.
 */
export function resolveRequestId(request?: Request): string {
  if (request) {
    const incoming = request.headers.get("x-request-id");
    if (incoming && /^req_[a-zA-Z0-9_-]{8,64}$/.test(incoming)) {
      return incoming;
    }
  }
  return generateRequestId();
}


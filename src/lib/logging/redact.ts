// =============================================================================
// GlobalPay — Sensitive Data Redaction
// =============================================================================
// Threat Model T6, T14: Prevent credentials, secrets, tokens, and PII from
// leaking into logs, error responses, and audit records.
// =============================================================================

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /key/i,
  /auth/i,
  /cookie/i,
  /authorization/i,
  /credential/i,
  /card/i,
  /cvv/i,
  /pan/i,
  /accountnumber/i,
  /database_url/i,
];

const MASK_REPLACEMENT = "[REDACTED]";

/**
 * Checks whether a given field name matches known sensitive key patterns.
 */
export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * Redacts known sensitive fields from an object, array, or string.
 * Returns a deep-cloned safe structure with sensitive values replaced.
 */
export function redactSensitiveData(data: unknown, depth = 0): unknown {
  if (depth > 8) {
    return "[MAX_DEPTH_REACHED]";
  }

  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === "string") {
    // Redact database URLs containing credentials
    let cleaned = data.replace(
      /(mysql|postgres|postgresql):\/\/[^:]+:[^@]+@/gi,
      "$1://[USER]:[REDACTED]@"
    );
    // Redact Bearer tokens
    cleaned = cleaned.replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]");
    return cleaned;
  }

  if (typeof data !== "object") {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      result[key] = MASK_REPLACEMENT;
    } else {
      result[key] = redactSensitiveData(value, depth + 1);
    }
  }

  return result;
}


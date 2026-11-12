// =============================================================================
// GlobalPay — API Error Class
// =============================================================================
// Structured operational error mapped to the API error catalogue (api-contract.md §10).
// Ensures safe error codes and messages are returned to the client without
// leaking stack traces, database details, or raw provider payloads.
// =============================================================================

export interface ValidationErrorDetail {
  field?: string;
  issue: string;
}

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "BANK_LINKING_REQUIRED"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "INVALID_AMOUNT"
  | "UNSUPPORTED_CURRENCY"
  | "QUOTE_INVALID_OR_EXPIRED"
  | "PAYMENT_METHOD_UNAVAILABLE"
  | "ORDER_NOT_APPROVED"
  | "PROVIDER_DATA_MISMATCH"
  | "TRANSACTION_STATE_CONFLICT"
  | "IDEMPOTENCY_CONFLICT"
  | "CONTENT_TOO_LARGE"
  | "MESSAGE_INVALID"
  | "RATE_LIMITED"
  | "PAYPAL_PROVIDER_ERROR"
  | "PAYPAL_CONFIGURATION_ERROR"
  | "AI_PROVIDER_ERROR"
  | "PAYPAL_UNAVAILABLE"
  | "QUOTE_UNAVAILABLE"
  | "AI_UNAVAILABLE"
  | "PAYMENT_STATUS_UNCONFIRMED"
  | "PAYPAL_TIMEOUT"
  | "AI_TIMEOUT"
  | "INTERNAL_ERROR";

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: ApiErrorCode;
  public readonly details?: ValidationErrorDetail[];
  public readonly isOperational: boolean;

  constructor(options: {
    statusCode: number;
    code: ApiErrorCode;
    message: string;
    details?: ValidationErrorDetail[];
    isOperational?: boolean;
    cause?: unknown;
  }) {
    super(options.message);
    this.name = "ApiError";
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.details = options.details;
    this.isOperational = options.isOperational ?? true;

    if (options.cause) {
      this.cause = options.cause;
    }

    Object.setPrototypeOf(this, new.target.prototype);
  }

  // Pre-configured factory methods for common error shapes
  static badRequest(message = "Invalid request format.", details?: ValidationErrorDetail[]): ApiError {
    return new ApiError({ statusCode: 400, code: "BAD_REQUEST", message, details });
  }

  static unauthenticated(message = "Session is missing or expired."): ApiError {
    return new ApiError({ statusCode: 401, code: "UNAUTHENTICATED", message });
  }

  static forbidden(message = "Operation not permitted."): ApiError {
    return new ApiError({ statusCode: 403, code: "FORBIDDEN", message });
  }

  static bankLinkingRequired(
    message = "A linked bank account is required before making payments. Please link a bank account to proceed."
  ): ApiError {
    return new ApiError({ statusCode: 403, code: "BANK_LINKING_REQUIRED", message });
  }

  static notFound(message = "The requested resource was not found."): ApiError {
    return new ApiError({ statusCode: 404, code: "NOT_FOUND", message });
  }

  static conflict(
    code: "TRANSACTION_STATE_CONFLICT" | "IDEMPOTENCY_CONFLICT" = "TRANSACTION_STATE_CONFLICT",
    message = "Operation conflicts with current state."
  ): ApiError {
    return new ApiError({ statusCode: 409, code, message });
  }

  static validationError(details: ValidationErrorDetail[], message = "Check the highlighted fields and try again."): ApiError {
    return new ApiError({ statusCode: 422, code: "VALIDATION_ERROR", message, details });
  }

  static rateLimited(message = "Too many requests. Please slow down."): ApiError {
    return new ApiError({ statusCode: 429, code: "RATE_LIMITED", message });
  }

  static internal(message = "An unexpected error occurred. Please try again later.", cause?: unknown): ApiError {
    return new ApiError({ statusCode: 500, code: "INTERNAL_ERROR", message, cause, isOperational: false });
  }
}

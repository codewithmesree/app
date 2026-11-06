// =============================================================================
// GlobalPay — Centralized API Error Handler
// =============================================================================
// Formats errors into the canonical API contract error envelope (api-contract.md §1.2).
// Logs redacted diagnostics with correlation requestId.
// =============================================================================

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError, ValidationErrorDetail } from "./api-error";
import { logger } from "../logging/logger";
import { resolveRequestId } from "../request-id";

export interface ErrorResponseEnvelope {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: ValidationErrorDetail[];
  };
}

/**
 * Maps Zod errors into standard ValidationErrorDetail items.
 */
function formatZodDetails(zodError: ZodError): ValidationErrorDetail[] {
  return zodError.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join(".") : undefined,
    issue: issue.message,
  }));
}

/**
 * Handles any thrown error in an API Route Handler and returns a safe NextResponse.
 */
export function handleApiError(
  error: unknown,
  request?: Request,
  customRequestId?: string
): NextResponse<ErrorResponseEnvelope> {
  const requestId = customRequestId || resolveRequestId(request);

  // 1. Handled operational ApiError
  if (error instanceof ApiError) {
    if (error.statusCode >= 500) {
      logger.error(`Server error: ${error.message}`, {
        requestId,
        context: { code: error.code, details: error.details },
        error,
      });
    } else {
      logger.warn(`Operational error: ${error.code} - ${error.message}`, {
        requestId,
        context: { code: error.code, details: error.details },
      });
    }

    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          requestId,
          details: error.details,
        },
      },
      {
        status: error.statusCode,
        headers: {
          "x-request-id": requestId,
          "cache-control": "no-store",
        },
      }
    );
  }

  // 2. Zod validation error
  if (error instanceof ZodError) {
    const details = formatZodDetails(error);
    logger.warn("Validation error on request", {
      requestId,
      context: { details },
    });

    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Check the highlighted fields and try again.",
          requestId,
          details,
        },
      },
      {
        status: 422,
        headers: {
          "x-request-id": requestId,
          "cache-control": "no-store",
        },
      }
    );
  }

  // 3. Unhandled error (unexpected exception, Prisma connection drop, etc.)
  // Never expose raw exception message or stack trace to client
  logger.error("Unhandled API exception", {
    requestId,
    error,
  });

  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred. Please try again later.",
        requestId,
      },
    },
    {
      status: 500,
      headers: {
        "x-request-id": requestId,
        "cache-control": "no-store",
      },
    }
  );
}


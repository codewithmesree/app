// =============================================================================
// GlobalPay — Structured Logger
// =============================================================================
// Output structured JSON logs with automatic sensitive data redaction.
// Adheres to Threat Model T6, T14: Never log credentials or private tokens.
// =============================================================================

import { redactSensitiveData } from "./redact";

export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogPayload {
  level: LogLevel;
  message: string;
  timestamp: string;
  requestId?: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
}

class AppLogger {
  private format(
    level: LogLevel,
    message: string,
    meta?: { requestId?: string; context?: Record<string, unknown>; error?: unknown }
  ): LogPayload {
    const payload: LogPayload = {
      level,
      message,
      timestamp: new Date().toISOString(),
    };

    if (meta?.requestId) {
      payload.requestId = meta.requestId;
    }

    if (meta?.context) {
      payload.context = redactSensitiveData(meta.context) as Record<string, unknown>;
    }

    if (meta?.error) {
      if (meta.error instanceof Error) {
        payload.error = {
          name: meta.error.name,
          message: meta.error.message,
          code: (meta.error as { code?: string }).code,
          stack: process.env.NODE_ENV === "production" ? undefined : meta.error.stack,
        };
      } else {
        payload.error = {
          name: "UnknownError",
          message: String(meta.error),
        };
      }
    }

    return payload;
  }

  private write(payload: LogPayload): void {
    const line = JSON.stringify(payload);
    if (payload.level === "error") {
      console.error(line);
    } else if (payload.level === "warn") {
      console.warn(line);
    } else {
      console.log(line);
    }
  }

  debug(message: string, meta?: { requestId?: string; context?: Record<string, unknown> }): void {
    if (process.env.NODE_ENV !== "production") {
      this.write(this.format("debug", message, meta));
    }
  }

  info(message: string, meta?: { requestId?: string; context?: Record<string, unknown> }): void {
    this.write(this.format("info", message, meta));
  }

  warn(
    message: string,
    meta?: { requestId?: string; context?: Record<string, unknown>; error?: unknown }
  ): void {
    this.write(this.format("warn", message, meta));
  }

  error(
    message: string,
    meta?: { requestId?: string; context?: Record<string, unknown>; error?: unknown }
  ): void {
    this.write(this.format("error", message, meta));
  }
}

export const logger = new AppLogger();


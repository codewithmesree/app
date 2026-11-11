// =============================================================================
// GlobalPay — PayPal Configuration
// =============================================================================
// PRD §7.3, architecture.md §10:
// Server-only configuration for PayPal Sandbox REST API.
// =============================================================================

import "server-only";
import { z } from "zod";

export class PayPalConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayPalConfigurationError";
  }
}

export interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  returnUrl: string;
  cancelUrl: string;
  requestTimeoutMs: number;
  payeeEmail: string;
}

export function getPayPalConfig(): PayPalConfig {
  const clientId = (process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID || "").trim();
  const clientSecret = (process.env.PAYPAL_CLIENT_SECRET || "").trim();
  const baseUrl = (process.env.PAYPAL_BASE_URL || "https://api-m.sandbox.paypal.com").replace(/\/+$/, "");
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  const returnUrl = process.env.PAYPAL_RETURN_URL || `${appUrl}/pay/return`;
  const cancelUrl = process.env.PAYPAL_CANCEL_URL || `${appUrl}/pay/cancel`;
  const payeeEmail = process.env.PAYPAL_PAYEE_EMAIL?.trim();
  const requestTimeoutMs = 8000;

  if (!clientId) {
    throw new PayPalConfigurationError("PAYPAL_CONFIGURATION_MISSING_CLIENT_ID");
  }

  if (!clientSecret) {
    throw new PayPalConfigurationError("PAYPAL_CONFIGURATION_MISSING_CLIENT_SECRET");
  }

  try {
    new URL(baseUrl);
  } catch {
    throw new PayPalConfigurationError("PAYPAL_CONFIGURATION_INVALID_BASE_URL");
  }

  if (!payeeEmail || !z.string().email().safeParse(payeeEmail).success) {
    throw new PayPalConfigurationError("PAYPAL_CONFIGURATION_INVALID_PAYEE_EMAIL");
  }

  return {
    clientId,
    clientSecret,
    baseUrl,
    returnUrl,
    cancelUrl,
    requestTimeoutMs,
    payeeEmail,
  };
}

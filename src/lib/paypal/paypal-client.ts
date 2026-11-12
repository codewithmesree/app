// =============================================================================
// GlobalPay — PayPal Sandbox REST Client
// =============================================================================
// PRD §7.3, architecture.md §10, payment-flow.md §17.2:
// Server-only abstraction for PayPal REST API (v1 OAuth, v2 Orders, v2 Capture).
// Keeps secrets strictly server-side, caches OAuth access tokens safely,
// and enforces timeout bounds with AbortController.
// =============================================================================

import "server-only";
import { logger } from "../logging/logger";
import { getPayPalConfig } from "./paypal-config";

export interface PayPalOAuthToken {
  accessToken: string;
  expiresAt: number;
}

export interface CreateOrderParams {
  transactionId: string;
  amount: string;
  currency: string;
  description: string;
  customId?: string;
}

export interface PayPalOrderResponse {
  id: string;
  status: "CREATED" | "SAVED" | "APPROVED" | "VOIDED" | "COMPLETED" | "PAYER_ACTION_REQUIRED";
  approvalUrl: string;
}

export interface PayPalCaptureResponse {
  captureId?: string;
  status: string;
  amount: string;
  currency: string;
  payeeEmail?: string;
  payeeMerchantId?: string;
}

export interface PayPalOrderDetails {
  id: string;
  status: string;
  amount: string;
  currency: string;
  payerId?: string;
  payeeEmail?: string;
  payeeMerchantId?: string;
  captures?: Array<{
    id: string;
    status: string;
    amount: string;
    currency: string;
  }>;
}

export class PayPalOrderCreationError extends Error {
  constructor(
    message: string,
    readonly outcome: "rejected" | "unknown",
    /** PayPal's documented issue code (e.g. CURRENCY_NOT_SUPPORTED), when provided. */
    readonly issue?: string
  ) {
    super(message);
    this.name = "PayPalOrderCreationError";
  }
}

/** PayPal answered 404 for an order: it never existed for this app or has expired and been purged. */
export class PayPalOrderNotFoundError extends Error {
  constructor() {
    super("PAYPAL_GET_ORDER_FAILED_404");
    this.name = "PayPalOrderNotFoundError";
  }
}

/**
 * A non-2xx answer from PayPal's capture endpoint. Carries only the HTTP status
 * and PayPal's documented error `name` / first `details[].issue` codes (both
 * validated as plain upper-case identifiers); never the raw body.
 */
export class PayPalCaptureError extends Error {
  constructor(
    readonly httpStatus: number,
    readonly errorName?: string,
    readonly issue?: string
  ) {
    super(`PAYPAL_CAPTURE_FAILED_${httpStatus}`);
    this.name = "PayPalCaptureError";
  }
}

const PAYPAL_CODE_PATTERN = /^[A-Z0-9_]{1,80}$/;

function safeCode(value: unknown): string | undefined {
  return typeof value === "string" && PAYPAL_CODE_PATTERN.test(value) ? value : undefined;
}

/** Extracts PayPal's error `name` and first `details[].issue` without trusting the body's shape. */
async function readPayPalError(response: Response): Promise<{ name?: string; issue?: string }> {
  try {
    const body: unknown = await response.json();
    if (typeof body !== "object" || body === null) return {};
    const record = body as Record<string, unknown>;
    const details = record.details;
    const first: unknown = Array.isArray(details) ? details[0] : undefined;
    const issue = typeof first === "object" && first !== null
      ? safeCode((first as Record<string, unknown>).issue)
      : undefined;
    return { name: safeCode(record.name), issue };
  } catch {
    return {};
  }
}

/** Extracts PayPal's first `details[].issue` code from an error body without trusting its shape. */
async function readPayPalIssue(response: Response): Promise<string | undefined> {
  return (await readPayPalError(response)).issue;
}

export function validatePayPalApprovalUrl(value: unknown): string {
  if (typeof value !== "string") {
    throw new PayPalOrderCreationError("PAYPAL_INVALID_APPROVAL_URL", "unknown");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new PayPalOrderCreationError("PAYPAL_INVALID_APPROVAL_URL", "unknown");
  }

  if (
    url.protocol !== "https:" ||
    url.hostname !== "www.sandbox.paypal.com" ||
    url.username ||
    url.password ||
    url.hash ||
    !url.pathname.startsWith("/checkoutnow")
  ) {
    throw new PayPalOrderCreationError("PAYPAL_INVALID_APPROVAL_URL", "unknown");
  }

  return url.toString();
}

export class PayPalClient {
  private cachedToken: PayPalOAuthToken | null = null;

  /**
   * Acquires or reuses a valid OAuth 2.0 access token via Client Credentials grant.
   * Proactively renews if within 60 seconds of expiration.
   */
  async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && now < this.cachedToken.expiresAt - 60_000) {
      return this.cachedToken.accessToken;
    }

    const config = getPayPalConfig();
    const authHeader = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
    const tokenUrl = `${config.baseUrl}/v1/oauth2/token`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);

    let response: Response;
    try {
      response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${authHeader}`,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: "grant_type=client_credentials",
        signal: controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timer);
      const isAbort = err instanceof Error && err.name === "AbortError";
      logger.error(isAbort ? "PayPal OAuth request timed out" : "PayPal OAuth network error", {
        context: { error: String(err) },
      });
      throw new Error(isAbort ? "PAYPAL_TIMEOUT" : "PAYPAL_PROVIDER_ERROR");
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      logger.error("PayPal OAuth request rejected", {
        context: { status: response.status, statusText: response.statusText },
      });
      throw new Error(`PAYPAL_AUTH_FAILED_${response.status}`);
    }

    const data = await response.json();
    const accessToken = data.access_token as string;
    const expiresIn = (data.expires_in as number) || 3600;

    this.cachedToken = {
      accessToken,
      expiresAt: now + expiresIn * 1000,
    };

    return accessToken;
  }

  /**
   * Creates a PayPal v2 Checkout Order with intent: CAPTURE.
   * Optionally attaches PayPal-Request-Id header for provider idempotency.
   */
  async createOrder(params: CreateOrderParams, requestId?: string): Promise<PayPalOrderResponse> {
    const config = getPayPalConfig();
    const token = await this.getAccessToken();
    const url = `${config.baseUrl}/v2/checkout/orders`;

    const payload = {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: params.transactionId,
          custom_id: params.customId || params.transactionId,
          description: params.description,
          amount: {
            currency_code: params.currency,
            value: params.amount,
          },
        },
      ],
      application_context: {
        return_url: config.returnUrl,
        cancel_url: config.cancelUrl,
        user_action: "PAY_NOW",
        shipping_preference: "NO_SHIPPING",
      },
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (requestId) {
      headers["PayPal-Request-Id"] = requestId;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timer);
      const isAbort = err instanceof Error && err.name === "AbortError";
      logger.error(isAbort ? "PayPal create order request timed out" : "PayPal create order network error", {
        context: { transactionId: params.transactionId, error: String(err) },
      });
      throw new PayPalOrderCreationError(
        isAbort ? "PAYPAL_TIMEOUT" : "PAYPAL_PROVIDER_ERROR",
        "unknown"
      );
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const issue = await readPayPalIssue(response);
      logger.error("PayPal create order failed", {
        context: { status: response.status, issue, currency: params.currency },
      });
      throw new PayPalOrderCreationError(
        `PAYPAL_ORDER_CREATION_FAILED_${response.status}`,
        response.status >= 500 ? "unknown" : "rejected",
        issue
      );
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new PayPalOrderCreationError("PAYPAL_INVALID_ORDER_RESPONSE", "unknown");
    }

    if (typeof data !== "object" || data === null) {
      throw new PayPalOrderCreationError("PAYPAL_INVALID_ORDER_RESPONSE", "unknown");
    }

    const orderData = data as Record<string, unknown>;
    const id = typeof orderData.id === "string" ? orderData.id : "";
    const status = orderData.status;
    const links: unknown[] = Array.isArray(orderData.links) ? orderData.links : [];
    const approveLink = links.find((link) => {
      if (typeof link !== "object" || link === null) return false;
      const candidate = link as Record<string, unknown>;
      return candidate.rel === "approve" && typeof candidate.href === "string";
    });
    const approvalUrl = validatePayPalApprovalUrl(
      typeof approveLink === "object" && approveLink !== null
        ? (approveLink as Record<string, unknown>).href
        : undefined
    );

    if (!id || status !== "CREATED") {
      throw new PayPalOrderCreationError("PAYPAL_INVALID_ORDER_RESPONSE", "unknown");
    }
    return {
      id,
      status,
      approvalUrl,
    };
  }

  /**
   * Retrieves an existing PayPal order to verify status and amount.
   */
  async getOrder(orderId: string): Promise<PayPalOrderDetails> {
    const config = getPayPalConfig();
    const token = await this.getAccessToken();
    const url = `${config.baseUrl}/v2/checkout/orders/${orderId}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        signal: controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timer);
      throw new Error(err instanceof Error && err.name === "AbortError" ? "PAYPAL_TIMEOUT" : "PAYPAL_PROVIDER_ERROR");
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 404) {
      throw new PayPalOrderNotFoundError();
    }
    if (!response.ok) {
      throw new Error(`PAYPAL_GET_ORDER_FAILED_${response.status}`);
    }

    const data = await response.json();
    const pu = data.purchase_units?.[0];
    const payee = pu?.payee;
    const rawCaptures = pu?.payments?.captures || [];
    const captures = rawCaptures.map((c: { id?: string; status?: string; amount?: { value?: string; currency_code?: string } }) => ({
      id: c.id || "",
      status: c.status || "",
      amount: c.amount?.value || "",
      currency: c.amount?.currency_code || "",
    }));

    return {
      id: data.id,
      status: data.status,
      amount: pu?.amount?.value || "",
      currency: pu?.amount?.currency_code || "",
      payerId: data.payer?.payer_id,
      payeeEmail: payee?.email_address,
      payeeMerchantId: payee?.merchant_id,
      captures,
    };
  }

  /**
   * Executes server-side capture of an approved PayPal order.
   * Optionally attaches PayPal-Request-Id header for provider idempotency.
   */
  async captureOrder(orderId: string, requestId?: string): Promise<PayPalCaptureResponse> {
    const config = getPayPalConfig();
    const token = await this.getAccessToken();
    const url = `${config.baseUrl}/v2/checkout/orders/${orderId}/capture`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (requestId) {
      headers["PayPal-Request-Id"] = requestId;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers,
        signal: controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timer);
      throw new Error(err instanceof Error && err.name === "AbortError" ? "PAYPAL_TIMEOUT" : "PAYPAL_PROVIDER_ERROR");
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const { name, issue } = await readPayPalError(response);
      logger.error("PayPal capture failed", {
        context: { orderId, status: response.status, name, issue },
      });
      throw new PayPalCaptureError(response.status, name, issue);
    }

    const data = await response.json();
    const pu = data.purchase_units?.[0];
    const capture = pu?.payments?.captures?.[0];
    const payee = pu?.payee;

    return {
      captureId: capture?.id,
      status: capture?.status || data.status,
      amount: capture?.amount?.value || "",
      currency: capture?.amount?.currency_code || "",
      payeeEmail: payee?.email_address,
      payeeMerchantId: payee?.merchant_id,
    };
  }
}

export const payPalClient = new PayPalClient();

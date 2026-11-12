"use client";

import { XCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Reveal } from "@/components/motion/reveal";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { PaymentStatusBadge } from "@/components/payment/payment-status-badge";
import type { TransactionStatus } from "@/features/payment/payment-types";
import { getMerchantPaymentHref } from "@/lib/qr/demo-qr";

type ReconcileOutcome = "CANCELLED" | "EXPIRED" | "FAILED" | "UNCHANGED";

interface CancelResult {
  status: TransactionStatus;
  outcome: ReconcileOutcome;
  merchantId: string;
}

const STATUSES: TransactionStatus[] = [
  "CREATED",
  "AWAITING_APPROVAL",
  "CAPTURE_PENDING",
  "COMPLETED",
  "CANCELLED",
  "FAILED",
  "STATUS_UNKNOWN",
];
const OUTCOMES: ReconcileOutcome[] = ["CANCELLED", "EXPIRED", "FAILED", "UNCHANGED"];

// One server reconciliation per PayPal token, shared across React Strict Mode
// effect re-runs so a duplicate request can never observe a held lease.
const cancelRequests = new Map<string, Promise<CancelResult>>();

function reconcileCancelledOrder(token: string): Promise<CancelResult> {
  const existing = cancelRequests.get(token);
  if (existing) return existing;

  const request = fetch("/api/payments/paypal/cancel", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  }).then(async (response) => {
    const payload: unknown = await response.json().catch(() => null);
    const data = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
    if (
      !response.ok ||
      typeof data.transactionId !== "string" ||
      typeof data.merchantId !== "string" ||
      !STATUSES.includes(data.status as TransactionStatus) ||
      !OUTCOMES.includes(data.outcome as ReconcileOutcome)
    ) {
      throw new Error("The current payment status could not be verified.");
    }
    return {
      status: data.status as TransactionStatus,
      outcome: data.outcome as ReconcileOutcome,
      merchantId: data.merchantId,
    };
  });

  cancelRequests.set(token, request);
  request.catch(() => cancelRequests.delete(token));
  return request;
}

function describeResult(result: CancelResult): string {
  if (result.status === "COMPLETED") {
    return "The server has a verified PayPal Sandbox completion record.";
  }
  if (result.status === "CANCELLED") {
    return result.outcome === "EXPIRED"
      ? "This PayPal order expired before it was approved. No successful Sandbox capture was recorded."
      : "Payment cancelled. No successful Sandbox capture was recorded.";
  }
  if (result.status === "FAILED") {
    return "PayPal voided this order. No successful Sandbox capture was recorded.";
  }
  if (result.status === "STATUS_UNKNOWN" || result.status === "CAPTURE_PENDING") {
    return "The provider outcome is not confirmed. Check transaction history before starting another attempt.";
  }
  return "PayPal has not confirmed that this order was cancelled. Check transaction history before starting another attempt.";
}

export function PaymentCancelClient() {
  const [state, setState] = useState<"loading" | "error" | CancelResult>("loading");

  useEffect(() => {
    let active = true;
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token || token.length > 64) {
      void Promise.resolve().then(() => {
        if (active) setState("error");
      });
      return;
    }

    reconcileCancelledOrder(token)
      .then((result) => {
        if (active) setState(result);
      })
      .catch(() => {
        if (active) setState("error");
      });

    return () => {
      active = false;
    };
  }, []);

  const result = state !== "loading" && state !== "error" ? state : null;
  const canRetry = result !== null && (result.status === "CANCELLED" || result.status === "FAILED");

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 py-16 text-center">
      <Reveal>
        <div className="flex flex-col items-center">
          <span className="grid size-16 place-items-center rounded-full bg-warning/20 text-warning">
            <XCircle aria-hidden className="size-10" />
          </span>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            PayPal checkout return
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            A return to this page does not determine the payment outcome. GlobalPay verifies the order with PayPal
            before recording it.
          </p>
        </div>
      </Reveal>

      <Reveal order={1}>
        {state === "loading" ? (
          <p role="status" className="text-sm text-ink-muted">
            Checking the current payment status with PayPal…
          </p>
        ) : state === "error" || !result ? (
          <Alert tone="warning" title="Payment status not verified">
            We could not associate this return with a transaction in your session. No payment state has been changed.
          </Alert>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <PaymentStatusBadge status={result.status} />
            <Badge tone="neutral">GlobalPay server record</Badge>
            <p role="status" className="text-sm text-ink-muted">
              {describeResult(result)}
            </p>
          </div>
        )}
      </Reveal>

      {canRetry ? (
        <Reveal order={2}>
          <Alert tone="info" title="Did PayPal say the seller doesn't accept your currency?">
            That message comes from the PayPal Sandbox buyer account you signed in with, not from GlobalPay. GlobalPay
            sent the merchant&rsquo;s own currency without converting it. Sign in to PayPal with a Sandbox personal
            account from the same country as the GlobalPay Sandbox business account (for example, a US personal account)
            and try again.
          </Alert>
        </Reveal>
      ) : null}

      <Reveal order={2}>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          {canRetry && result ? (
            <Link
              href={getMerchantPaymentHref(result.merchantId)}
              className="inline-flex min-h-12 items-center justify-center rounded-control bg-primary px-6 text-sm font-medium text-white hover:bg-primary-hover"
            >
              Try again
              <ArrowRight aria-hidden className="ml-2 size-4" />
            </Link>
          ) : (
            <Link
              href="/transactions"
              className="inline-flex min-h-12 items-center justify-center rounded-control bg-primary px-6 text-sm font-medium text-white hover:bg-primary-hover"
            >
              Check activity
              <ArrowRight aria-hidden className="ml-2 size-4" />
            </Link>
          )}
          <Link
            href="/dashboard"
            className="inline-flex min-h-12 items-center justify-center rounded-control border border-line px-5 text-sm font-medium text-ink-muted hover:text-ink"
          >
            Return to Dashboard
          </Link>
        </div>
      </Reveal>
    </div>
  );
}

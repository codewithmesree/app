"use client";

import { CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Reveal } from "@/components/motion/reveal";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDecimal } from "@/lib/format-money";
import {
  POST_PAYMENT_REDIRECT_DELAY_MS,
  POST_PAYMENT_REDIRECT_PATH,
  shouldRedirectAfterPayment,
} from "@/lib/payments/post-payment-redirect";
import { reconcilePaymentReturn, type ReturnOutcome } from "@/lib/payments/payment-return-reconciler";

type ReturnView =
  | { kind: "loading"; reconciling: boolean }
  | ReturnOutcome;

export function PaymentReturnClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token"); // PayPal order ID
  const [view, setView] = useState<ReturnView>({ kind: "loading", reconciling: false });
  const [runCount, setRunCount] = useState(0);

  // Capture once, then keep reconciling automatically until PayPal gives a
  // definitive answer or the polling window ends. Aborting on cleanup stops the
  // loop on unmount; Strict Mode's second effect run shares the in-flight
  // request, and the server's idempotency key + capture lease make any
  // duplicate request safe.
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();

    reconcilePaymentReturn(token, {
      signal: controller.signal,
      onProgress: () => {
        if (!controller.signal.aborted) setView({ kind: "loading", reconciling: true });
      },
    }).then((outcome) => {
      if (outcome && !controller.signal.aborted) setView(outcome);
    });

    return () => controller.abort();
  }, [token, runCount]);

  // Redirect to the dashboard only after the backend confirms COMPLETED.
  // The timer is cleared on unmount or state change, and the ref guarantees a
  // single navigation even if the effect re-runs (e.g. React Strict Mode).
  const hasRedirectedRef = useRef(false);
  const captured = view.kind === "completed" ? view.payment : null;
  const isConfirmedComplete = shouldRedirectAfterPayment(captured);

  useEffect(() => {
    if (!isConfirmedComplete || hasRedirectedRef.current) return;

    const timer = setTimeout(() => {
      if (hasRedirectedRef.current) return;
      hasRedirectedRef.current = true;
      router.replace(POST_PAYMENT_REDIRECT_PATH);
    }, POST_PAYMENT_REDIRECT_DELAY_MS);

    return () => clearTimeout(timer);
  }, [isConfirmedComplete, router]);

  function goToDashboardNow() {
    hasRedirectedRef.current = true;
  }

  function recheckStatus() {
    // Manual fallback: restart the automatic reconciliation window. The same
    // idempotency key returns the stored result or reconciles with PayPal.
    setView({ kind: "loading", reconciling: true });
    setRunCount((count) => count + 1);
  }

  const error = !token
    ? "No payment token was provided in the return URL."
    : view.kind === "error"
      ? view.message
      : null;

  if (!error && view.kind === "loading") {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 py-16 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-lavender/20 text-lavender animate-pulse">
          <CheckCircle2 aria-hidden className="size-8" />
        </span>
        <Badge tone="info">Verifying with PayPal</Badge>
        <h1 className="text-2xl font-semibold text-ink sm:text-3xl">
          Confirming Payment Status...
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-ink-muted">
          {view.reconciling
            ? "PayPal is still finalising this payment. We are checking again automatically. Please do not close this window."
            : "We are executing server-side capture against PayPal Sandbox. Please do not close this window."}
        </p>
      </div>
    );
  }

  if (view.kind === "failed") {
    const cancelled = view.status === "CANCELLED";
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 py-16 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-danger/20 text-danger">
          <AlertTriangle aria-hidden className="size-8" />
        </span>
        <Badge tone={cancelled ? "neutral" : "danger"}>{view.status}</Badge>
        <h1 className="text-2xl font-semibold text-ink sm:text-3xl">
          {cancelled ? "Payment Cancelled" : "Payment Failed"}
        </h1>
        <p className="text-sm text-ink-muted">
          {cancelled
            ? "PayPal approval was not completed, so no payment was taken."
            : "PayPal did not complete this payment, so no money was taken. You can start a new payment."}
        </p>
        <div className="mt-4 flex gap-3">
          <Link
            href="/dashboard"
            className="inline-flex min-h-11 items-center justify-center rounded-control bg-primary px-5 text-sm font-medium text-white hover:bg-primary-hover"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (error || view.kind === "loading") {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 py-16 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-danger/20 text-danger">
          <AlertTriangle aria-hidden className="size-8" />
        </span>
        <Badge tone="danger">Verification Error</Badge>
        <h1 className="text-2xl font-semibold text-ink sm:text-3xl">
          Payment Unconfirmed
        </h1>
        <p className="text-sm text-ink-muted">{error}</p>
        <div className="mt-4 flex gap-3">
          <Link
            href="/dashboard"
            className="inline-flex min-h-11 items-center justify-center rounded-control bg-primary px-5 text-sm font-medium text-white hover:bg-primary-hover"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (view.kind === "under_review" || !captured) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 py-16 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-warning/20 text-warning">
          <AlertTriangle aria-hidden className="size-8" />
        </span>
        <Badge tone="warning">Status Not Confirmed</Badge>
        <h1 className="text-2xl font-semibold text-ink sm:text-3xl">
          Payment Under Review
        </h1>
        <p className="text-sm text-ink-muted">
          We could not verify the PayPal result yet. We checked with PayPal automatically for about a minute without a final answer; this can happen when PayPal is still processing. Do not start another payment while this transaction is being reconciled.
        </p>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={recheckStatus}
            className="inline-flex min-h-11 items-center justify-center rounded-control bg-primary px-5 text-sm font-medium text-white hover:bg-primary-hover"
          >
            Check Status Again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex min-h-11 items-center justify-center rounded-control border border-line px-5 text-sm font-medium text-ink-muted hover:text-ink"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 py-8 text-center">
      <Reveal>
        <div className="flex flex-col items-center">
          <span className="grid size-16 place-items-center rounded-full bg-success/20 text-success">
            <CheckCircle2 aria-hidden className="size-10" />
          </span>
          <Badge tone="success" className="mt-4">
            PayPal Sandbox Payment Verified
          </Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Payment Completed
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Your transaction has been verified and captured successfully via PayPal Sandbox.
          </p>
        </div>
      </Reveal>

      <Reveal order={1}>
        <Card className="flex flex-col gap-3 text-left">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <span className="text-xs text-ink-subtle">Transaction ID</span>
            <span className="font-mono text-xs text-ink">{captured.transactionId}</span>
          </div>
          <div className="flex items-center justify-between border-b border-line pb-3">
            <span className="text-xs text-ink-subtle">Amount Captured</span>
            <span className="font-mono text-sm font-semibold text-ink">
              {formatDecimal(captured.amount)} {captured.currency}
            </span>
          </div>
          <div className="flex items-center justify-between border-b border-line pb-3">
            <span className="text-xs text-ink-subtle">PayPal Capture Ref</span>
            <span className="font-mono text-xs text-lavender">{captured.providerCaptureId || "Verified"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-subtle">Status</span>
            <Badge tone="success">COMPLETED</Badge>
          </div>
        </Card>
      </Reveal>

      <Reveal order={2}>
        <div className="flex flex-col gap-3">
          <p role="status" aria-live="polite" className="text-xs text-ink-muted">
            Taking you to your dashboard in a few seconds…
          </p>
          <Link
            href={POST_PAYMENT_REDIRECT_PATH}
            replace
            onClick={goToDashboardNow}
            className="inline-flex min-h-12 items-center justify-center rounded-control bg-primary px-6 text-sm font-medium text-white hover:bg-primary-hover"
          >
            Return to Dashboard
            <ArrowRight aria-hidden className="ml-2 size-4" />
          </Link>
          <Link
            href="/transactions"
            className="inline-flex min-h-11 items-center justify-center rounded-control border border-line px-4 text-sm font-medium text-ink-muted hover:text-ink"
          >
            View All Transactions
          </Link>
        </div>
      </Reveal>
    </div>
  );
}

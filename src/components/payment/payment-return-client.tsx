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

interface CapturedState {
  transactionId: string;
  status: string;
  amount: string;
  currency: string;
  capturedAt?: string;
  providerCaptureId?: string;
}

// One server-side resolve + capture per PayPal token, shared across React
// Strict Mode effect re-runs. Without this, development mode sends two capture
// requests: the second finds the first one's lease and reports "under review"
// even when the first capture succeeded. Failed requests are evicted so the
// user can retry; the server's idempotency key makes retries safe.
const captureRequests = new Map<string, Promise<CapturedState>>();

async function errorMessage(response: Response, fallback: string): Promise<string> {
  const data: unknown = await response.json().catch(() => null);
  if (typeof data === "object" && data !== null) {
    const error = (data as Record<string, unknown>).error;
    if (typeof error === "object" && error !== null) {
      const message = (error as Record<string, unknown>).message;
      if (typeof message === "string" && message) return message;
    }
  }
  return fallback;
}

function resolveAndCapture(token: string): Promise<CapturedState> {
  const existing = captureRequests.get(token);
  if (existing) return existing;

  const request = (async () => {
    // 1. Authoritatively resolve the session-owned transaction matching this PayPal order token
    const resolveRes = await fetch(`/api/payments/paypal/resolve?token=${encodeURIComponent(token)}`, {
      cache: "no-store",
    });
    if (!resolveRes.ok) {
      throw new Error(await errorMessage(resolveRes, "Could not resolve matching transaction for this order."));
    }
    const resolved = await resolveRes.json();
    const transactionId = resolved.transactionId;

    // 2. Perform authoritative server-side capture or recovery
    const idempotencyKey = `capture_${transactionId}_${token}`;
    const captureRes = await fetch("/api/payments/paypal/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId, idempotencyKey }),
    });
    if (!captureRes.ok) {
      throw new Error(await errorMessage(captureRes, "Failed to capture payment."));
    }
    return (await captureRes.json()) as CapturedState;
  })();

  captureRequests.set(token, request);
  request.catch(() => captureRequests.delete(token));
  return request;
}

export function PaymentReturnClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token"); // PayPal order ID
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [captured, setCaptured] = useState<CapturedState | null>(null);
  const [recheckCount, setRecheckCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function processReturn() {
      if (!token) {
        if (isMounted) {
          setError("No payment token was provided in the return URL.");
          setLoading(false);
        }
        return;
      }

      try {
        const captureData = await resolveAndCapture(token);
        if (isMounted) {
          setCaptured(captureData);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Payment capture failed.");
          setLoading(false);
        }
      }
    }

    processReturn();

    return () => {
      isMounted = false;
    };
  }, [token, recheckCount]);

  // Redirect to the dashboard only after the backend confirms COMPLETED.
  // The timer is cleared on unmount or state change, and the ref guarantees a
  // single navigation even if the effect re-runs (e.g. React Strict Mode).
  const hasRedirectedRef = useRef(false);
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
    // Re-ask the server; the same idempotency key returns the stored result or reconciles.
    if (token) captureRequests.delete(token);
    setError(null);
    setCaptured(null);
    setLoading(true);
    setRecheckCount((count) => count + 1);
  }

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 py-16 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-lavender/20 text-lavender animate-pulse">
          <CheckCircle2 aria-hidden className="size-8" />
        </span>
        <Badge tone="info">Verifying with PayPal</Badge>
        <h1 className="text-2xl font-semibold text-ink sm:text-3xl">
          Confirming Payment Status...
        </h1>
        <p className="text-sm text-ink-muted">
          We are executing server-side capture against PayPal Sandbox. Please do not close this window.
        </p>
      </div>
    );
  }

  if (error || !captured) {
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

  if (captured.status !== "COMPLETED") {
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
          We could not verify the PayPal result yet. Do not start another payment while this transaction is being reconciled.
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

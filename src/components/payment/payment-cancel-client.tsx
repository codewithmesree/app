"use client";

import { XCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Reveal } from "@/components/motion/reveal";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { PaymentStatusBadge } from "@/components/payment/payment-status-badge";
import type { TransactionStatus } from "@/features/payment/payment-types";

export function PaymentCancelClient() {
  const [status, setStatus] = useState<"loading" | "error" | TransactionStatus>("loading");

  useEffect(() => {
    const controller = new AbortController();
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token || token.length > 200) {
      void Promise.resolve().then(() => {
        if (!controller.signal.aborted) setStatus("error");
      });
      return;
    }

    void fetch(`/api/payments/paypal/resolve?token=${encodeURIComponent(token)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json();
        const transactionStatus = payload?.status;
        const statuses: TransactionStatus[] = [
          "CREATED",
          "AWAITING_APPROVAL",
          "CAPTURE_PENDING",
          "COMPLETED",
          "CANCELLED",
          "FAILED",
          "STATUS_UNKNOWN",
        ];
        if (
          !response.ok ||
          typeof payload?.transactionId !== "string" ||
          !statuses.includes(transactionStatus)
        ) {
          throw new Error("The current payment status could not be verified.");
        }
        setStatus(transactionStatus);
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("error");
      });

    return () => controller.abort();
  }, []);

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
            A return to this page does not determine the payment outcome. Check the server-confirmed transaction status
            before trying again.
          </p>
        </div>
      </Reveal>

      <Reveal order={1}>
        {status === "loading" ? (
          <p role="status" className="text-sm text-ink-muted">
            Checking the current payment status…
          </p>
        ) : status === "error" ? (
          <Alert tone="warning" title="Payment status not verified">
            We could not associate this return with a transaction in your session. No payment state has been changed.
          </Alert>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <PaymentStatusBadge status={status} />
            <Badge tone="neutral">GlobalPay server record</Badge>
            <p className="text-sm text-ink-muted">
              {status === "COMPLETED"
                ? "The server has a verified PayPal Sandbox completion record."
                : status === "STATUS_UNKNOWN" || status === "CAPTURE_PENDING"
                  ? "The provider outcome is not confirmed. Check transaction history before starting another attempt."
                  : "This transaction has not been marked complete by the server."}
            </p>
          </div>
        )}
      </Reveal>

      <Reveal order={1}>
        <div className="mt-4 flex gap-3">
          <Link
            href="/transactions"
            className="inline-flex min-h-12 items-center justify-center rounded-control bg-primary px-6 text-sm font-medium text-white hover:bg-primary-hover"
          >
            Check activity
            <ArrowRight aria-hidden className="ml-2 size-4" />
          </Link>
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

"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, RotateCw, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { MoneyAmount } from "@/components/ui/money-amount";
import { PaymentStatusBadge } from "@/components/payment/payment-status-badge";
import { SandboxBadge } from "@/components/payment/sandbox-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PAYMENT_STATUS } from "@/features/payment/payment-status";
import type { TransactionDetail, TransactionStatus } from "@/features/payment/payment-types";
import { formatDateTimeUtc } from "@/lib/format-date";

type DetailState =
  | { status: "loading" }
  | { status: "ready"; transaction: TransactionDetail }
  | { status: "not_found" }
  | { status: "error" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTransactionStatus(value: unknown): value is TransactionStatus {
  return typeof value === "string" && Object.hasOwn(PAYMENT_STATUS, value);
}

function isTransactionDetail(value: unknown): value is TransactionDetail {
  if (!isRecord(value) || !isRecord(value.merchant)) return false;
  if (
    typeof value.id !== "string" ||
    typeof value.merchant.name !== "string" ||
    (value.merchant.countryCode !== null && typeof value.merchant.countryCode !== "string") ||
    typeof value.amount !== "string" ||
    typeof value.currency !== "string" ||
    typeof value.createdAt !== "string" ||
    !isTransactionStatus(value.status)
  ) {
    return false;
  }

  if (value.completedAt !== undefined && typeof value.completedAt !== "string") return false;
  if (value.providerCaptureId !== undefined && typeof value.providerCaptureId !== "string") return false;
  if (value.indicativeEstimate === undefined) return true;
  if (!isRecord(value.indicativeEstimate)) return false;

  const estimate = value.indicativeEstimate;
  return (
    typeof estimate.homeCurrency === "string" &&
    typeof estimate.estimatedHomeAmount === "string" &&
    typeof estimate.rate === "string" &&
    (estimate.asOf === undefined || typeof estimate.asOf === "string") &&
    (estimate.baseCurrency === undefined || typeof estimate.baseCurrency === "string") &&
    (estimate.quoteCurrency === undefined || typeof estimate.quoteCurrency === "string")
  );
}

export function TransactionReceiptDrawer({
  transactionId,
  onClose,
}: {
  transactionId: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/transactions/${encodeURIComponent(transactionId)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 404) {
          setState({ status: "not_found" });
          return;
        }
        if (!response.ok) throw new Error("Transaction details request failed.");

        const payload: unknown = await response.json();
        if (!isRecord(payload) || !isTransactionDetail(payload.transaction)) {
          throw new Error("Transaction details response was invalid.");
        }
        setState({ status: "ready", transaction: payload.transaction });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: "error" });
      });

    return () => controller.abort();
  }, [retryCount, transactionId]);

  const retry = () => {
    setState({ status: "loading" });
    setRetryCount((count) => count + 1);
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="transaction-receipt-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) dialogRef.current?.close();
      }}
      className="fixed inset-y-0 right-0 m-0 h-dvh w-full max-w-none overflow-y-auto border-0 border-l border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/60 sm:w-[min(100vw,32rem)]"
    >
      <div className="flex min-h-full flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-4 sm:px-7">
          <div className="flex min-w-0 flex-col items-start gap-2">
            <p id="transaction-receipt-title" className="label-mono text-ink-muted">
              Digital receipt
            </p>
            <SandboxBadge />
          </div>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Close transaction receipt"
            className="grid size-11 shrink-0 place-items-center rounded-control text-ink-muted hover:bg-surface-muted hover:text-ink"
          >
            <X aria-hidden className="size-5" />
          </button>
        </header>

        <main className="flex-1 px-5 py-6 sm:px-7 sm:py-8">
          {state.status === "loading" ? <LoadingReceipt /> : null}
          {state.status === "error" ? (
            <div className="space-y-5" role="alert">
              <Alert tone="danger" title="Receipt unavailable">
                We couldn’t load this transaction. Check your connection and try again.
              </Alert>
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" onClick={retry}>
                  <RotateCw aria-hidden className="size-4" />
                  Try again
                </Button>
                <Button variant="ghost" onClick={() => dialogRef.current?.close()}>
                  <ArrowLeft aria-hidden className="size-4" />
                  Back to activity
                </Button>
              </div>
            </div>
          ) : null}
          {state.status === "not_found" ? (
            <div className="space-y-5" role="status">
              <Alert tone="info" title="Transaction not found">
                This transaction isn’t available in your session.
              </Alert>
              <Button variant="secondary" onClick={() => dialogRef.current?.close()}>
                <ArrowLeft aria-hidden className="size-4" />
                Back to activity
              </Button>
            </div>
          ) : null}
          {state.status === "ready" ? <ReceiptDetails transaction={state.transaction} /> : null}
        </main>

        <footer className="border-t border-line px-5 py-4 sm:px-7">
          <p className="text-xs leading-relaxed text-ink-subtle">
            Demo receipt — PayPal Sandbox. No real money moved, and this does not represent a real-world
            merchant settlement.
          </p>
        </footer>
      </div>
    </dialog>
  );
}

function LoadingReceipt() {
  return (
    <div className="space-y-6" role="status" aria-busy="true">
      <p className="sr-only">Loading transaction receipt</p>
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-48 max-w-full" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="h-28 w-full rounded-card" />
      <div className="space-y-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  );
}

function ReceiptDetails({ transaction }: { transaction: TransactionDetail }) {
  const countryName = transaction.merchant.countryCode
    ? new Intl.DisplayNames(["en"], { type: "region" }).of(transaction.merchant.countryCode)
    : undefined;
  const estimate = transaction.indicativeEstimate;

  return (
    <div className="space-y-7">
      <section>
        <p className="label-mono text-ink-subtle">Merchant</p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight">{transaction.merchant.name}</h2>
        {countryName ? <p className="mt-1 text-sm text-ink-muted">{countryName}</p> : null}
      </section>

      <section className="rounded-card border border-line bg-surface-raised p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="label-mono text-ink-subtle">Transaction amount</p>
          <PaymentStatusBadge status={transaction.status} />
        </div>
        <MoneyAmount
          amount={transaction.amount}
          currency={transaction.currency}
          className="mt-4 block text-4xl font-semibold tracking-tight"
        />
        {estimate ? (
          <div className="mt-6 border-t border-line pt-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-ink-muted">Indicative converted amount</p>
              <span className="label-mono text-ink-subtle">Estimate only</span>
            </div>
            <MoneyAmount
              amount={estimate.estimatedHomeAmount}
              currency={estimate.homeCurrency}
              className="mt-2 block text-xl font-medium"
            />
            <dl className="mt-4 space-y-3 text-sm">
              <ReceiptRow label="Indicative FX rate">
                {estimate.baseCurrency && estimate.quoteCurrency
                  ? `1 ${estimate.baseCurrency} = ${estimate.rate} ${estimate.quoteCurrency}`
                  : estimate.rate}
              </ReceiptRow>
              {estimate.asOf ? (
                <ReceiptRow label="Quote timestamp">
                  <time dateTime={estimate.asOf}>{formatDateTimeUtc(estimate.asOf)}</time>
                </ReceiptRow>
              ) : null}
            </dl>
          </div>
        ) : null}
      </section>

      <section>
        <h3 className="label-mono text-ink-subtle">Transaction details</h3>
        <dl className="mt-4 divide-y divide-line border-y border-line">
          <ReceiptRow label="Reference">
            <span className="break-all font-mono text-xs">{transaction.id}</span>
          </ReceiptRow>
          <ReceiptRow label="Transaction date">
            <time dateTime={transaction.createdAt}>{formatDateTimeUtc(transaction.createdAt)}</time>
          </ReceiptRow>
          {transaction.status === "COMPLETED" && transaction.completedAt ? (
            <ReceiptRow label="Completed">
              <time dateTime={transaction.completedAt}>
                {formatDateTimeUtc(transaction.completedAt)}
              </time>
            </ReceiptRow>
          ) : null}
          {transaction.status === "COMPLETED" && transaction.providerCaptureId ? (
            <ReceiptRow label="PayPal Sandbox capture reference">
              <span className="break-all font-mono text-xs">{transaction.providerCaptureId}</span>
            </ReceiptRow>
          ) : null}
        </dl>
        {transaction.status === "STATUS_UNKNOWN" ? (
          <p className="mt-4 text-sm text-warning">
            Payment status has not been confirmed. This is not a completed payment.
          </p>
        ) : null}
        {transaction.status !== "STATUS_UNKNOWN" && transaction.status !== "COMPLETED" ? (
          <p className="mt-4 text-sm text-ink-muted">{PAYMENT_STATUS[transaction.status].label}</p>
        ) : null}
      </section>
    </div>
  );
}

function ReceiptRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-left sm:text-right">{children}</dd>
    </div>
  );
}

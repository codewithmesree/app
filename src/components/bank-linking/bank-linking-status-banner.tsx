"use client";

import { ArrowRight, ChevronRight, Landmark } from "lucide-react";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { useBankLinking } from "@/features/bank-linking/bank-linking-context";
import { BankLinkingBadge } from "./bank-linking-badge";

export function BankLinkingStatusBanner() {
  const { state } = useBankLinking();
  const { status, account } = state;

  return (
    <div
      role="region"
      aria-label="Bank account linking status"
      className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 transition-colors duration-150 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3.5 min-w-0">
        <span className="grid size-9 shrink-0 place-items-center rounded-control border border-line bg-surface-muted text-ink-muted">
          <Landmark aria-hidden className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <BankLinkingBadge status={status} />
            {account && status === "linked" ? (
              <span className="font-mono text-xs text-ink-muted">
                {account.institutionName} ({account.maskedAccountNumber})
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-[13px] text-ink-muted">
            {status === "not_linked" &&
              "Explore mode active. Browse merchants, currencies and estimates freely. Link an account when ready to test payments."}
            {status === "linked" &&
              "Ready for PayPal Sandbox checkout. Payments are authorized via mock test mandate."}
            {status === "linking_in_progress" &&
              "Simulated open-banking authorization in progress. Click below to complete."}
            {status === "linking_failed" &&
              "The last linking attempt could not be completed. You can retry anytime."}
            {status === "connection_expired" &&
              "Bank connection token expired. Re-authentication is required to make payments."}
            {status === "reconnection_required" &&
              "Security policy requires account re-consent before initiating new payments."}
          </p>
        </div>
      </div>

      <div className="shrink-0 pt-1 sm:pt-0">
        {status === "not_linked" && (
          <ButtonLink
            href="/connect-bank"
            variant="secondary"
            className="min-h-9 px-3.5 py-1.5 text-xs font-semibold sm:text-sm"
          >
            Link bank account
            <ArrowRight aria-hidden className="size-3.5 shrink-0 text-lavender" />
          </ButtonLink>
        )}

        {status === "linked" && (
          <Link
            href="/settings"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-control px-3 py-1.5 text-xs font-medium text-lavender transition-colors hover:text-lavender-hover hover:underline"
          >
            Manage in Settings
            <ChevronRight aria-hidden className="size-3.5 shrink-0" />
          </Link>
        )}

        {(status === "connection_expired" || status === "reconnection_required") && (
          <ButtonLink
            href="/connect-bank"
            variant="secondary"
            className="min-h-9 px-3.5 py-1.5 text-xs font-semibold text-warning sm:text-sm"
          >
            Reconnect account
            <ArrowRight aria-hidden className="size-3.5 shrink-0" />
          </ButtonLink>
        )}

        {status === "linking_failed" && (
          <ButtonLink
            href="/connect-bank"
            variant="secondary"
            className="min-h-9 px-3.5 py-1.5 text-xs font-semibold text-danger sm:text-sm"
          >
            Retry linking
            <ArrowRight aria-hidden className="size-3.5 shrink-0" />
          </ButtonLink>
        )}

        {status === "linking_in_progress" && (
          <ButtonLink
            href="/connect-bank"
            variant="secondary"
            className="min-h-9 px-3.5 py-1.5 text-xs font-semibold text-info sm:text-sm"
          >
            Continue linking
            <ArrowRight aria-hidden className="size-3.5 shrink-0" />
          </ButtonLink>
        )}
      </div>
    </div>
  );
}


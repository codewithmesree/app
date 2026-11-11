"use client";

import {
  ArrowRight,
  EyeOff,
  FlaskConical,
  KeyRound,
  Lock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { Reveal } from "@/components/motion/reveal";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type BankLinkingIntroScreenProps = {
  /** Called when the user clicks "Continue to secure bank linking". */
  onContinue: () => void;
  /** Destination for "Maybe later" or back action. Defaults to "/dashboard". */
  returnTo?: string;
  /** Context header explaining why this screen appeared (e.g., when attempting to pay). */
  contextNotice?: string;
  operationError?: string | null;
};

export function BankLinkingIntroScreen({
  onContinue,
  returnTo = "/dashboard",
  contextNotice,
  operationError,
}: BankLinkingIntroScreenProps) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-4">
      {operationError ? (
        <Alert tone="danger" title="Bank connection was not updated">
          {operationError}
        </Alert>
      ) : null}
      {contextNotice ? (
        <Reveal>
          <div className="flex items-center gap-3 rounded-card border border-warning/30 bg-warning/10 p-4 text-warning">
            <Lock aria-hidden className="size-5 shrink-0" />
            <p className="text-sm font-medium">{contextNotice}</p>
          </div>
        </Reveal>
      ) : null}

      {/* Hero Header */}
      <div className="flex flex-col items-center text-center">
        <Reveal>
          <p className="label-mono inline-flex items-center gap-2 rounded-full border border-line bg-surface-raised px-3.5 py-1.5 text-lavender">
            <ShieldCheck aria-hidden className="size-4 text-lavender" />
            Simulated bank connection
          </p>
        </Reveal>

        <Reveal order={1}>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink sm:text-3xl lg:text-4xl">
            Connect a mock bank account
          </h1>
        </Reveal>

        <Reveal order={2}>
          <p className="mt-3 max-w-xl text-sm text-ink-muted sm:text-base">
            To create PayPal Sandbox demo orders, GlobalPay requires a simulated bank-linking status. No real bank
            account is accessed.
          </p>
        </Reveal>
      </div>

      {/* Security & Privacy Pillars */}
      <Reveal order={3}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2.5 rounded-card border border-line bg-surface p-4">
            <span className="grid size-9 place-items-center rounded-control bg-primary-soft text-lavender">
              <KeyRound aria-hidden className="size-4" />
            </span>
            <h3 className="text-sm font-semibold text-ink">No Bank Credentials</h3>
            <p className="text-[13px] leading-relaxed text-ink-muted">
              The demo never requests or stores a bank password, PIN, OTP, or real account number.
            </p>
          </div>

          <div className="flex flex-col gap-2.5 rounded-card border border-line bg-surface p-4">
            <span className="grid size-9 place-items-center rounded-control bg-primary-soft text-lavender">
              <EyeOff aria-hidden className="size-4" />
            </span>
            <h3 className="text-sm font-semibold text-ink">Masked Privacy</h3>
            <p className="text-[13px] leading-relaxed text-ink-muted">
              The interface displays mock institution and masked account details. No real account data or banking token
              is exchanged.
            </p>
          </div>

          <div className="flex flex-col gap-2.5 rounded-card border border-line bg-surface p-4">
            <span className="grid size-9 place-items-center rounded-control bg-primary-soft text-lavender">
              <Sparkles aria-hidden className="size-4" />
            </span>
            <h3 className="text-sm font-semibold text-ink">Optional for Exploring</h3>
            <p className="text-[13px] leading-relaxed text-ink-muted">
              You can explore international currencies, indicative quotes, and demo merchants freely without ever linking
              an account.
            </p>
          </div>
        </div>
      </Reveal>

      {/* How it works explanation */}
      <Reveal order={4}>
        <div className="rounded-card border border-line bg-surface-raised p-5">
          <h2 className="text-sm font-semibold text-ink">Why is linking required for payments?</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
            In this prototype, connecting updates a simulated eligibility record used to gate PayPal Sandbox demo
            orders. It does not verify authorization with a bank or move money.
          </p>
        </div>
      </Reveal>

      {/* Action Controls */}
      <Reveal order={5}>
        <div className="flex flex-col items-center gap-3 pt-2">
          <Button
            variant="accent"
            onClick={onContinue}
            className="min-h-13 w-full max-w-md text-base sm:min-h-14"
          >
            Continue to mock bank linking
            <ArrowRight aria-hidden className="size-5 shrink-0" />
          </Button>

          <Link
            href={returnTo}
            className="inline-flex min-h-11 items-center justify-center rounded-control px-4 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
          >
            Maybe later — return to explore
          </Link>

          <p className="flex items-center gap-2 pt-2 text-center text-xs text-warning">
            <FlaskConical aria-hidden className="size-3.5 shrink-0" />
            Demo limitation: Bank linking is simulated; no real banking integration is present.
          </p>
        </div>
      </Reveal>
    </div>
  );
}

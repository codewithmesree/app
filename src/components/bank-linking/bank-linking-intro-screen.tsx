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
import { Button } from "@/components/ui/button";

type BankLinkingIntroScreenProps = {
  /** Called when the user clicks "Continue to secure bank linking". */
  onContinue: () => void;
  /** Destination for "Maybe later" or back action. Defaults to "/dashboard". */
  returnTo?: string;
  /** Context header explaining why this screen appeared (e.g., when attempting to pay). */
  contextNotice?: string;
};

export function BankLinkingIntroScreen({
  onContinue,
  returnTo = "/dashboard",
  contextNotice,
}: BankLinkingIntroScreenProps) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-4">
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
            Secure Open-Banking Connection
          </p>
        </Reveal>

        <Reveal order={1}>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink sm:text-3xl lg:text-4xl">
            Connect your bank account
          </h1>
        </Reveal>

        <Reveal order={2}>
          <p className="mt-3 max-w-xl text-sm text-ink-muted sm:text-base">
            To pay merchants and test international checkout flows in GlobalPay, a connected bank account is
            required to authorize payment mandates.
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
            <h3 className="text-sm font-semibold text-ink">Zero Credential Access</h3>
            <p className="text-[13px] leading-relaxed text-ink-muted">
              We never request, see, or store your bank password, PIN, or OTPs. Linking is conducted via external
              regulated banking handshakes.
            </p>
          </div>

          <div className="flex flex-col gap-2.5 rounded-card border border-line bg-surface p-4">
            <span className="grid size-9 place-items-center rounded-control bg-primary-soft text-lavender">
              <EyeOff aria-hidden className="size-4" />
            </span>
            <h3 className="text-sm font-semibold text-ink">Masked Privacy</h3>
            <p className="text-[13px] leading-relaxed text-ink-muted">
              Only safely masked identifiers (e.g. &bull;&bull;&bull;&bull; 4821) and cryptographic access tokens are
              exchanged. Full account numbers remain private.
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
            GlobalPay verifies traveller authorization with your banking institution before initiating merchant
            transactions. In this hackathon milestone, connecting establishes a simulated open-banking mandate so you
            can test PayPal Sandbox checkout without using real money.
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
            Continue to secure bank linking
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
            Frontend milestone: Bank linking is simulated with mock sandbox credentials.
          </p>
        </div>
      </Reveal>
    </div>
  );
}


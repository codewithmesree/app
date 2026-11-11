"use client";

import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Landmark,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Unplug,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Reveal } from "@/components/motion/reveal";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useBankLinking } from "@/features/bank-linking/bank-linking-context";
import { MOCK_BANKS_CATALOG } from "@/features/bank-linking/bank-linking-mock-data";
import { BankLinkingBadge } from "./bank-linking-badge";
import { BankLinkingIntroScreen } from "./bank-linking-intro-screen";

type BankLinkingFlowViewProps = {
  returnTo?: string;
  contextNotice?: string;
};

export function BankLinkingFlowView({ returnTo = "/dashboard", contextNotice }: BankLinkingFlowViewProps) {
  const {
    state,
    operationError,
    startLinking,
    completeLinking,
    failLinking,
    disconnect,
  } = useBankLinking();

  const [selectedBankId, setSelectedBankId] = useState<string>("chase");
  const [isSimulatingProcessing, setIsSimulatingProcessing] = useState(false);

  const selectedBank = MOCK_BANKS_CATALOG.find((b) => b.id === selectedBankId) ?? MOCK_BANKS_CATALOG[0];

  function handleCompleteSimulatedHandoff() {
    setIsSimulatingProcessing(true);
    setTimeout(() => {
      void completeLinking({ institutionId: selectedBank.id }).finally(() => {
        setIsSimulatingProcessing(false);
      });
    }, 600);
  }

  function handleSimulateFailure() {
    setIsSimulatingProcessing(true);
    setTimeout(() => {
      void failLinking("Mock Open Banking provider returned verification error (SIMULATED_AUTH_TIMEOUT).").finally(
        () => setIsSimulatingProcessing(false)
      );
    }, 500);
  }

  // 1. Not linked state: Show the introduction view
  if (state.status === "not_linked") {
    return (
      <BankLinkingIntroScreen
        onContinue={startLinking}
        returnTo={returnTo}
        contextNotice={contextNotice}
        operationError={operationError}
      />
    );
  }

  // 2. Linking in progress: Show the mock Open-Banking consent & handshake simulation
  if (state.status === "linking_in_progress") {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-4">
        {operationError ? (
          <Alert tone="danger" title="Bank connection was not updated">
            {operationError}
          </Alert>
        ) : null}
        <Reveal>
          <div className="flex flex-col items-center text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-primary-soft text-lavender">
              <LoaderCircle aria-hidden className="size-6 animate-spin" />
            </span>
            <div className="mt-3">
              <BankLinkingBadge status="linking_in_progress" />
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Simulated Banking Provider Handoff
            </h1>
            <p className="mt-2 text-sm text-ink-muted">
              Choose a mock institution to simulate an Open Banking authorization handshake.
            </p>
          </div>
        </Reveal>

        <Reveal order={1}>
          <Alert tone="warning" title="Frontend Milestone Simulation">
            This is a mock banking handshake for testing. In production, GlobalPay would redirect to the
            regulated bank&rsquo;s OAuth portal. GlobalPay never collects or stores banking passwords or credentials.
          </Alert>
        </Reveal>

        <Reveal order={2}>
          <Card className="flex flex-col gap-4">
            <h2 className="label-mono text-ink-muted">Select mock test institution</h2>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {MOCK_BANKS_CATALOG.map((bank) => {
                const isSelected = bank.id === selectedBankId;
                return (
                  <button
                    key={bank.id}
                    type="button"
                    onClick={() => setSelectedBankId(bank.id)}
                    className={`flex items-center justify-between rounded-control border p-3.5 text-left transition-all ${
                      isSelected
                        ? "border-primary bg-primary-soft/50 ring-1 ring-primary"
                        : "border-line bg-canvas hover:border-ink-subtle"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-semibold text-ink">{bank.name}</p>
                      <p className="font-mono text-xs text-ink-muted">
                        {bank.accountType} &middot; {bank.maskedNumber}
                      </p>
                    </div>
                    {isSelected ? (
                      <CheckCircle2 aria-hidden className="size-4 shrink-0 text-lavender" />
                    ) : (
                      <span aria-hidden className="size-4 shrink-0 rounded-full border border-line" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="rounded-control border border-line bg-surface-raised p-3.5">
              <p className="text-xs text-ink-muted">
                <strong className="text-ink">Selected:</strong> {selectedBank.name} ({selectedBank.maskedNumber})
                &middot; Country: {selectedBank.country}
              </p>
            </div>
          </Card>
        </Reveal>

        <Reveal order={3}>
          <div className="flex flex-col gap-3">
            <Button
              variant="accent"
              loading={isSimulatingProcessing}
              onClick={handleCompleteSimulatedHandoff}
              className="min-h-13 w-full text-base"
            >
              Confirm mock connection
              <ArrowRight aria-hidden className="size-5 shrink-0" />
            </Button>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <Button
                variant="secondary"
                disabled={isSimulatingProcessing}
                onClick={handleSimulateFailure}
                className="text-xs text-danger sm:text-sm"
              >
                Simulate provider error
              </Button>
              <Button
                variant="ghost"
                disabled={isSimulatingProcessing}
                onClick={disconnect}
                className="text-xs sm:text-sm"
              >
                Cancel linking
              </Button>
            </div>
          </div>
        </Reveal>
      </div>
    );
  }

  // 3. Successfully linked state
  if (state.status === "linked" && state.account) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-4">
        {operationError ? (
          <Alert tone="danger" title="Bank connection was not updated">
            {operationError}
          </Alert>
        ) : null}
        <Reveal>
          <div className="flex flex-col items-center text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-success/20 text-success">
              <CheckCircle2 aria-hidden className="size-6" />
            </span>
            <div className="mt-3">
              <BankLinkingBadge status="linked" />
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Bank Account Connected
            </h1>
            <p className="mt-2 text-sm text-ink-muted">
              Payment access is enabled. You can now proceed to PayPal Sandbox checkout.
            </p>
          </div>
        </Reveal>

        <Reveal order={1}>
          <Card className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h2 className="label-mono text-ink-muted">Linked account details</h2>
              <Badge tone="success">Mock test mandate</Badge>
            </div>

            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
              <div>
                <dt className="text-xs text-ink-subtle">Institution</dt>
                <dd className="mt-0.5 font-medium text-ink">{state.account.institutionName}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-subtle">Account Identifier</dt>
                <dd className="mt-0.5 font-mono font-medium text-ink">
                  {state.account.maskedAccountNumber}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-subtle">Account Type</dt>
                <dd className="mt-0.5 font-medium text-ink">{state.account.accountType}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-subtle">Payment Eligibility</dt>
                <dd className="mt-0.5 font-medium text-success">Active · PayPal Sandbox Test Ready</dd>
              </div>
            </dl>

            <div className="rounded-control border border-line bg-canvas p-3">
              <p className="flex items-center gap-2 text-xs text-ink-muted">
                <ShieldCheck aria-hidden className="size-4 shrink-0 text-success" />
                Raw credentials and PINs were never requested or stored.
              </p>
            </div>
          </Card>
        </Reveal>

        <Reveal order={2}>
          <div className="flex flex-col gap-3">
            <Link
              href="/pay"
              className="inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-control bg-lavender px-4 py-2 text-base font-semibold text-on-lavender shadow-button transition hover:bg-lavender-hover"
            >
              Continue to Pay Merchant
              <ArrowRight aria-hidden className="size-5 shrink-0" />
            </Link>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <Link
                href="/dashboard"
                className="inline-flex min-h-11 items-center rounded-control px-3 text-sm font-medium text-ink-muted hover:text-ink"
              >
                Return to Dashboard
              </Link>
              <Button variant="ghost" onClick={disconnect} className="text-xs text-danger sm:text-sm">
                <Unplug aria-hidden className="size-4 shrink-0" />
                Disconnect account
              </Button>
            </div>
          </div>
        </Reveal>
      </div>
    );
  }

  // 4. Linking failed state
  if (state.status === "linking_failed") {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-4">
        {operationError ? (
          <Alert tone="danger" title="Bank connection was not updated">
            {operationError}
          </Alert>
        ) : null}
        <Reveal>
          <div className="flex flex-col items-center text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-danger/20 text-danger">
              <AlertCircle aria-hidden className="size-6" />
            </span>
            <div className="mt-3">
              <BankLinkingBadge status="linking_failed" />
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Linking Could Not Be Completed
            </h1>
            <p className="mt-2 text-sm text-ink-muted">
              {state.notice ??
                "The banking provider encountered a verification timeout. No accounts were connected and no credentials were exchanged."}
            </p>
          </div>
        </Reveal>

        <Reveal order={1}>
          <Alert tone="danger" title="Connection Error">
            The banking simulation failed safely. Your explore access remains active; you can browse rates and
            merchants, or try linking again below.
          </Alert>
        </Reveal>

        <Reveal order={2}>
          <div className="flex flex-col gap-3">
            <Button variant="primary" onClick={startLinking} className="min-h-13 w-full text-base">
              <RefreshCw aria-hidden className="size-4 shrink-0" />
              Try connecting again
            </Button>
            <Link
              href="/dashboard"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-control border border-line bg-surface-muted text-sm font-medium text-ink hover:bg-surface-raised"
            >
              Maybe later &mdash; return to dashboard
            </Link>
          </div>
        </Reveal>
      </div>
    );
  }

  // 5. Connection expired state
  if (state.status === "connection_expired") {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-4">
        {operationError ? (
          <Alert tone="danger" title="Bank connection was not updated">
            {operationError}
          </Alert>
        ) : null}
        <Reveal>
          <div className="flex flex-col items-center text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-warning/20 text-warning">
              <Clock aria-hidden className="size-6" />
            </span>
            <div className="mt-3">
              <BankLinkingBadge status="connection_expired" />
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Bank Connection Expired
            </h1>
            <p className="mt-2 text-sm text-ink-muted">
              For security, open-banking mandates expire periodically. Please re-authenticate your connection to
              resume payments.
            </p>
          </div>
        </Reveal>

        {state.account ? (
          <Reveal order={1}>
            <Card className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Landmark aria-hidden className="size-5 text-ink-muted" />
                <div>
                  <p className="text-sm font-medium text-ink">{state.account.institutionName}</p>
                  <p className="font-mono text-xs text-ink-muted">{state.account.maskedAccountNumber}</p>
                </div>
              </div>
              <Badge tone="warning">Session Expired</Badge>
            </Card>
          </Reveal>
        ) : null}

        <Reveal order={2}>
          <div className="flex flex-col gap-3">
            <Button variant="accent" onClick={startLinking} className="min-h-13 w-full text-base">
              Reconnect bank account
              <ArrowRight aria-hidden className="size-5 shrink-0" />
            </Button>
            <Link
              href="/dashboard"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-control border border-line bg-surface-muted text-sm font-medium text-ink hover:bg-surface-raised"
            >
              Explore without reconnecting
            </Link>
          </div>
        </Reveal>
      </div>
    );
  }

  // 6. Reconnection required state
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-4">
      {operationError ? (
        <Alert tone="danger" title="Bank connection was not updated">
          {operationError}
        </Alert>
      ) : null}
      <Reveal>
        <div className="flex flex-col items-center text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-warning/20 text-warning">
            <ShieldAlert aria-hidden className="size-6" />
          </span>
          <div className="mt-3">
            <BankLinkingBadge status="reconnection_required" />
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Reconnection Required
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            The banking provider requires you to re-consent to open-banking authorization before any new payments can
            be approved.
          </p>
        </div>
      </Reveal>

      <Reveal order={1}>
        <Alert tone="warning" title="Security Re-Consent Needed">
          Your connection is temporarily paused. Explore mode remains fully functional, but payment flows are locked
          until re-consent is completed.
        </Alert>
      </Reveal>

      <Reveal order={2}>
        <div className="flex flex-col gap-3">
          <Button variant="accent" onClick={startLinking} className="min-h-13 w-full text-base">
            Complete re-consent now
            <ArrowRight aria-hidden className="size-5 shrink-0" />
          </Button>
          <Link
            href="/dashboard"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-control border border-line bg-surface-muted text-sm font-medium text-ink hover:bg-surface-raised"
          >
            Return to dashboard
          </Link>
        </div>
      </Reveal>
    </div>
  );
}

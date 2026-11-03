"use client";

import {
  ArrowRight,
  CheckCircle2,
  Lock,
  QrCode,
  ScanLine,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { BankLinkingFlowView } from "@/components/bank-linking/bank-linking-flow-view";
import { Reveal } from "@/components/motion/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useBankLinking } from "@/features/bank-linking/bank-linking-context";
import { getSampleMerchants } from "@/features/merchants/sample-merchants";
import { SAMPLE_PREFERENCES, useTravellerPreferences } from "@/features/travel/traveller-preferences";

export function ScanPageClient() {
  const { isPaymentEligible, state } = useBankLinking();
  const { preferences } = useTravellerPreferences();
  const { destinations } = preferences ?? SAMPLE_PREFERENCES;
  const destination = destinations[0];
  const merchants = getSampleMerchants(destination);

  const [selectedCode, setSelectedCode] = useState(merchants[0]?.id ?? "demo-1");
  const [showGateScreen, setShowGateScreen] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false);

  const currentMerchant = merchants.find((m) => m.id === selectedCode) ?? merchants[0];

  function handleInitiateQrPayment() {
    if (!isPaymentEligible) {
      setShowGateScreen(true);
      return;
    }
    setPaymentCompleted(true);
  }

  if (showGateScreen && !isPaymentEligible) {
    return (
      <BankLinkingFlowView
        returnTo="/scan"
        contextNotice="Bank account linking is required to authorize QR payments."
      />
    );
  }

  if (paymentCompleted && isPaymentEligible) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 py-6 text-center">
        <Reveal>
          <div className="flex flex-col items-center">
            <span className="grid size-14 place-items-center rounded-full bg-success/20 text-success">
              <CheckCircle2 aria-hidden className="size-8" />
            </span>
            <Badge tone="success" className="mt-4">
              Demo QR Payment Completed
            </Badge>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              QR Payment Simulated
            </h1>
            <p className="mt-2 text-sm text-ink-muted">
              Transaction simulated for {currentMerchant?.name} using linked account {state.account?.maskedAccountNumber}.
            </p>
          </div>
        </Reveal>
        <Reveal order={1}>
          <div className="flex flex-col gap-3">
            <Button variant="primary" onClick={() => setPaymentCompleted(false)}>
              Scan another demo QR
            </Button>
            <Link
              href="/dashboard"
              className="inline-flex min-h-11 items-center justify-center rounded-control px-4 text-sm font-medium text-ink-muted hover:text-ink"
            >
              Return to Dashboard
            </Link>
          </div>
        </Reveal>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-4">
      <Reveal>
        <div className="flex flex-col gap-1">
          <p className="label-mono text-ink-muted">Demo QR Scanner &middot; Explore &amp; Pay</p>
          <h1 className="text-2xl font-semibold text-ink sm:text-3xl">Scan QR Code</h1>
          <p className="text-sm text-ink-muted">
            Explore sample merchant QR codes. Initiating payment requires a linked bank account.
          </p>
        </div>
      </Reveal>

      {!isPaymentEligible ? (
        <Reveal order={1}>
          <div className="flex items-center justify-between gap-3 rounded-card border border-warning/30 bg-warning/10 p-4 text-warning">
            <div className="flex items-center gap-3">
              <Lock aria-hidden className="size-5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">Payment Locked &middot; Explore Mode</p>
                <p className="text-xs text-ink-muted">
                  You can inspect sample QR codes, but bank linking is required before initiating payment.
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              onClick={() => setShowGateScreen(true)}
              className="shrink-0 text-xs sm:text-sm"
            >
              Link account
            </Button>
          </div>
        </Reveal>
      ) : (
        <Reveal order={1}>
          <div className="flex items-center gap-2 rounded-card border border-success/30 bg-success/10 p-3 text-xs text-success">
            <ShieldCheck aria-hidden className="size-4 shrink-0" />
            Bank linked ({state.account?.maskedAccountNumber}) &middot; QR payments enabled
          </div>
        </Reveal>
      )}

      {/* Demo QR Selector */}
      <Reveal order={2}>
        <Card className="flex flex-col gap-4">
          <h2 className="label-mono text-ink-muted">Select supported sample demo QR</h2>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {merchants.map((merchant) => {
              const isSelected = merchant.id === selectedCode;
              return (
                <button
                  key={merchant.id}
                  type="button"
                  onClick={() => setSelectedCode(merchant.id)}
                  className={`flex items-center gap-3 rounded-control border p-3 text-left transition-all ${
                    isSelected
                      ? "border-primary bg-primary-soft/50 ring-1 ring-primary"
                      : "border-line bg-canvas hover:border-ink-subtle"
                  }`}
                >
                  <QrCode aria-hidden className="size-5 shrink-0 text-lavender" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{merchant.name}</p>
                    <p className="font-mono text-xs text-ink-muted">{merchant.label}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* QR Preview Card */}
          <div className="flex flex-col items-center justify-center rounded-control border border-line bg-surface-raised p-6 text-center">
            <div className="grid size-36 place-items-center rounded-2xl border-2 border-dashed border-line bg-canvas p-4 text-ink-muted">
              <ScanLine aria-hidden className="size-16 text-lavender" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-ink">{currentMerchant?.name}</h3>
            <p className="text-xs text-ink-muted">{currentMerchant?.place} &middot; Demo QR Schema v1.0</p>
            <p className="mt-2 font-mono text-lg font-bold text-lavender">2,800 JPY</p>
          </div>
        </Card>
      </Reveal>

      {/* Action */}
      <Reveal order={3}>
        <div className="flex flex-col gap-3">
          <Button
            variant={isPaymentEligible ? "accent" : "secondary"}
            onClick={handleInitiateQrPayment}
            className="min-h-14 text-base"
          >
            {isPaymentEligible ? (
              <>
                Confirm &amp; Pay Scanned QR
                <ArrowRight aria-hidden className="size-5 shrink-0" />
              </>
            ) : (
              <>
                <Lock aria-hidden className="size-4 shrink-0" />
                Link bank account to pay this QR
              </>
            )}
          </Button>

          <Link
            href="/dashboard"
            className="inline-flex min-h-11 items-center justify-center rounded-control px-4 text-sm font-medium text-ink-muted hover:text-ink"
          >
            Back to Dashboard
          </Link>
        </div>
      </Reveal>
    </div>
  );
}

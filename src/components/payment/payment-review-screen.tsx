"use client";

import {
  ArrowRight,
  CheckCircle2,
  Landmark,
  Store,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Reveal } from "@/components/motion/reveal";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useBankLinking } from "@/features/bank-linking/bank-linking-context";
import { getSampleQuote } from "@/features/currency/sample-quote";
import { getSampleMerchants } from "@/features/merchants/sample-merchants";
import { getCountry } from "@/features/travel/countries";
import { SAMPLE_PREFERENCES, useTravellerPreferences } from "@/features/travel/traveller-preferences";
import { formatDecimal } from "@/lib/format-money";

export function PaymentReviewScreen() {
  const { state } = useBankLinking();
  const { preferences } = useTravellerPreferences();
  const { homeCountry, destinations, displayCurrency } = preferences ?? SAMPLE_PREFERENCES;
  const destination = destinations[0];
  const { currency: merchantCurrency, name: countryName } = getCountry(destination);
  const merchants = getSampleMerchants(destination);

  const [selectedMerchantId, setSelectedMerchantId] = useState(merchants[0]?.id ?? "sample-merchant");
  const [amount] = useState("3500");
  const [checkoutSubmitted, setCheckoutSubmitted] = useState(false);

  const selectedMerchant = merchants.find((m) => m.id === selectedMerchantId) ?? merchants[0];
  const quote = getSampleQuote(amount, displayCurrency, merchantCurrency);

  const linkedAccount = state.account;

  if (checkoutSubmitted) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 py-6 text-center">
        <Reveal>
          <div className="flex flex-col items-center">
            <span className="grid size-14 place-items-center rounded-full bg-success/20 text-success">
              <CheckCircle2 aria-hidden className="size-8" />
            </span>
            <Badge tone="success" className="mt-4">
              Sandbox Test Payment Simulated
            </Badge>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Demo Checkout Completed
            </h1>
            <p className="mt-2 text-sm text-ink-muted">
              Transaction simulated for {selectedMerchant?.name ?? "Sample Merchant"}.
            </p>
          </div>
        </Reveal>

        <Reveal order={1}>
          <Card className="flex flex-col gap-3 text-left">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <span className="text-xs text-ink-subtle">Authorized Account</span>
              <span className="font-mono text-xs text-ink">{linkedAccount?.maskedAccountNumber}</span>
            </div>
            <div className="flex items-center justify-between border-b border-line pb-3">
              <span className="text-xs text-ink-subtle">Merchant Amount</span>
              <span className="font-mono text-sm font-semibold text-ink">
                {amount} {merchantCurrency}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-line pb-3">
              <span className="text-xs text-ink-subtle">Indicative Converted</span>
              <span className="font-mono text-sm font-semibold text-lavender">
                {quote ? formatDecimal(quote.baseAmount) : "---"}{" "}
                {displayCurrency}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-ink-subtle">Provider Status</span>
              <Badge tone="success">Verified (Sandbox Mock)</Badge>
            </div>
          </Card>
        </Reveal>

        <Reveal order={2}>
          <div className="flex flex-col gap-3">
            <Button variant="primary" onClick={() => setCheckoutSubmitted(false)}>
              Make another test payment
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
      {/* Header */}
      <Reveal>
        <div className="flex flex-col gap-1">
          <p className="label-mono text-ink-muted">Payment review &middot; PayPal Sandbox</p>
          <h1 className="text-2xl font-semibold text-ink sm:text-3xl">Pay Merchant</h1>
          <p className="text-sm text-ink-muted">
            Your bank account is linked and authorized for test transactions in {countryName}.
          </p>
        </div>
      </Reveal>

      {/* Linked Bank Account Banner */}
      <Reveal order={1}>
        <div className="flex items-center justify-between rounded-card border border-success/30 bg-success/10 p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-control bg-success/20 text-success">
              <Landmark aria-hidden className="size-4" />
            </span>
            <div>
              <p className="text-xs font-semibold text-success">Linked Payment Source</p>
              <p className="font-mono text-sm text-ink">
                {linkedAccount?.institutionName} ({linkedAccount?.maskedAccountNumber})
              </p>
            </div>
          </div>
          <Badge tone="success">Mandate Active</Badge>
        </div>
      </Reveal>

      {/* Merchant & Amount Selection */}
      <Reveal order={2}>
        <Card className="flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <h2 className="label-mono text-ink-muted">Choose sample merchant</h2>
            <Badge>Sample data</Badge>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {merchants.map((merchant) => {
              const isSelected = merchant.id === selectedMerchantId;
              return (
                <button
                  key={merchant.id}
                  type="button"
                  onClick={() => setSelectedMerchantId(merchant.id)}
                  className={`flex flex-col rounded-control border p-3 text-left transition-all ${
                    isSelected
                      ? "border-primary bg-primary-soft/50 ring-1 ring-primary"
                      : "border-line bg-canvas hover:border-ink-subtle"
                  }`}
                >
                  <Store aria-hidden className="size-4 text-ink-muted" />
                  <p className="mt-1 text-sm font-semibold text-ink">{merchant.name}</p>
                  <p className="text-xs text-ink-muted">{merchant.label}</p>
                </button>
              );
            })}
          </div>

          <div className="rounded-control border border-line bg-surface-raised p-4">
            <div className="flex items-baseline justify-between text-xs text-ink-muted">
              <span>Merchant price</span>
              <span>Indicative home estimate</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-mono text-2xl font-semibold text-ink">
                {amount} <span className="text-base text-ink-muted">{merchantCurrency}</span>
              </span>
              <span className="font-mono text-lg font-medium text-lavender">
                &asymp; {quote ? formatDecimal(quote.baseAmount) : "---"}{" "}
                {displayCurrency}
              </span>
            </div>
            <p className="mt-2 text-xs text-ink-muted">
              Based on indicative demo rate &middot; home country: {getCountry(homeCountry).name}
            </p>
          </div>
        </Card>
      </Reveal>

      {/* Sandbox Notice & Action */}
      <Reveal order={3}>
        <div className="flex flex-col gap-3">
          <Alert tone="warning" title="Test Environment">
            GlobalPay is operating in PayPal Sandbox mode. Clicking proceed simulates authorization against
            your linked test bank mandate. No actual money moves.
          </Alert>

          <Button
            variant="accent"
            onClick={() => setCheckoutSubmitted(true)}
            className="min-h-14 text-base"
          >
            Authorize Sandbox Payment
            <ArrowRight aria-hidden className="size-5 shrink-0" />
          </Button>

          <Link
            href="/dashboard"
            className="inline-flex min-h-11 items-center justify-center rounded-control px-4 text-sm font-medium text-ink-muted hover:text-ink"
          >
            Cancel and return to dashboard
          </Link>
        </div>
      </Reveal>
    </div>
  );
}

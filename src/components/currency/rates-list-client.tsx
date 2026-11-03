"use client";

import { useState } from "react";
import { Reveal } from "@/components/motion/reveal";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { CURRENCIES, getCurrency, type CurrencyCode } from "@/features/currency/currencies";
import { getSampleRate } from "@/features/currency/sample-quote";
import { SAMPLE_PREFERENCES, useTravellerPreferences } from "@/features/travel/traveller-preferences";

export function RatesListClient() {
  const { preferences } = useTravellerPreferences();
  const { displayCurrency } = preferences ?? SAMPLE_PREFERENCES;

  const [base, setBase] = useState<CurrencyCode>(displayCurrency);

  const otherCurrencies = CURRENCIES.filter((c) => c.code !== base);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Indicative Exchange Rates"
        description="Review indicative currency conversions for international destinations. Freely accessible in explore mode without bank linking."
        aside={
          <Badge tone="warning">
            Indicative Demo Rates &middot; Fixed Fixture
          </Badge>
        }
      />

      <Alert tone="warning" title="Indicative Rate Notice">
        Exchange rates shown are sample demonstration values, not real-time foreign exchange market data.
        In production, authoritative rates are locked at payment authorization.
      </Alert>

      {/* Base Currency Selector */}
      <Reveal>
        <Card className="flex flex-col gap-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="label-mono text-ink-muted">Base currency</span>
            <span className="text-xs text-ink-muted">Comparing from {getCurrency(base).name}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {CURRENCIES.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => setBase(c.code)}
                className={`rounded-control px-3 py-1.5 font-mono text-xs font-medium transition ${
                  base === c.code
                    ? "border border-lavender bg-primary-soft text-lavender ring-1 ring-lavender/30"
                    : "border border-line bg-surface-muted text-ink-muted hover:border-ink-subtle hover:text-ink"
                }`}
              >
                {c.code} ({c.symbol})
              </button>
            ))}
          </div>
        </Card>
      </Reveal>

      {/* Rates Table/Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {otherCurrencies.map((c, idx) => {
          const rate = getSampleRate(base, c.code);
          return (
            <Reveal key={c.code} order={idx % 6}>
              <Card className="flex flex-col justify-between gap-3 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-bold text-ink">{c.code}</span>
                    <span className="text-xs text-ink-muted">{c.name}</span>
                  </div>
                  <Badge>{c.area}</Badge>
                </div>

                <div className="rounded-control border border-line bg-canvas p-3">
                  <p className="text-xs text-ink-subtle">Indicative Exchange Rate</p>
                  <p className="mt-1 font-mono text-lg font-semibold text-lavender">
                    1 {base} = {rate} {c.code}
                  </p>
                </div>

                <p className="text-[11px] text-ink-muted">
                  Indicative quote &middot; Provider rate applied at PayPal checkout
                </p>
              </Card>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}

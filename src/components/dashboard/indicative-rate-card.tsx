"use client";

import { ArrowDown, QrCode, Store } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrency, type CurrencyCode } from "@/features/currency/currencies";
import type { RateStatus } from "@/features/currency/currency-types";
import { formatDateTimeUtc } from "@/lib/format-date";
import { formatDecimal } from "@/lib/format-money";
import { validateAmount } from "@/lib/validation/amount";

type IndicativeRateCardProps = {
  status: RateStatus;
  baseCurrency: CurrencyCode;
  quoteCurrency: CurrencyCode;
};

interface ApiQuoteState {
  rate: string;
  source: string;
  asOf: string;
  stale: boolean;
  status: "loading" | "ready" | "unavailable";
}

export function IndicativeRateCard({
  status: initialStatus,
  baseCurrency,
  quoteCurrency,
}: IndicativeRateCardProps) {
  const [quoteState, setQuoteState] = useState<ApiQuoteState>({
    rate: "",
    source: "",
    asOf: "",
    stale: false,
    status: initialStatus === "loading" ? "loading" : "loading",
  });

  useEffect(() => {
    let isMounted = true;

    // Fetch initial 1-unit indicative quote to discover current rate and status
    fetch("/api/currency/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        baseAmount: "1.00",
        baseCurrency,
        quoteCurrency,
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Status ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        if (data?.quote) {
          setQuoteState({
            rate: data.quote.rate,
            source: data.quote.source,
            asOf: data.quote.asOf,
            stale: Boolean(data.quote.stale),
            status: "ready",
          });
        } else {
          setQuoteState((prev) => ({ ...prev, status: "unavailable" }));
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setQuoteState((prev) => ({ ...prev, status: "unavailable" }));
      });

    return () => {
      isMounted = false;
    };
  }, [baseCurrency, quoteCurrency]);

  const effectiveStatus = quoteState.status;

  return (
    <Card aria-labelledby="rate-heading" aria-busy={effectiveStatus === "loading"} className="flex h-full flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line pb-4">
        <div className="flex items-center gap-2">
          <h2 id="rate-heading" className="label-mono text-ink-muted">
            Indicative conversion
          </h2>
          {quoteState.stale ? <Badge tone="warning">Cached (Stale)</Badge> : null}
        </div>
        {effectiveStatus === "ready" ? (
          <p className="font-mono text-[13px] text-lavender">
            Rate: 1 {baseCurrency} = {quoteState.rate} {quoteCurrency}
          </p>
        ) : null}
      </div>
      {effectiveStatus === "loading" ? <ConversionSkeleton /> : null}
      {effectiveStatus === "unavailable" ? (
        <Alert tone="warning" title="Rate unavailable">
          We couldn&rsquo;t refresh the exchange rate, so no estimate is shown. Try again once the rate source is back.
        </Alert>
      ) : null}
      {effectiveStatus === "ready" ? (
        <ConversionForm
          baseCurrency={baseCurrency}
          quoteCurrency={quoteCurrency}
          rateInfo={quoteState}
        />
      ) : null}
      <div className="mt-auto flex flex-col gap-3 pt-1">
        <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
          <ButtonLink href="/pay" className="min-h-14 text-base">
            <Store aria-hidden className="size-5" />
            Pay Merchant
          </ButtonLink>
          <ButtonLink href="/scan" variant="secondary" className="min-h-14 text-base">
            <QrCode aria-hidden className="size-5" />
            Scan QR
          </ButtonLink>
        </div>
        <p className="text-[13px] text-warning">Demo mode: PayPal Sandbox is used. No real money will move.</p>
      </div>
    </Card>
  );
}

function ConversionForm({
  baseCurrency,
  quoteCurrency,
  rateInfo,
}: {
  baseCurrency: CurrencyCode;
  quoteCurrency: CurrencyCode;
  rateInfo: ApiQuoteState;
}) {
  const { decimals } = getCurrency(baseCurrency);
  const [input, setInput] = useState(decimals === 0 ? "25000" : "250.00");
  const [convertedAmount, setConvertedAmount] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const id = useId();
  const errorId = `${id}-error`;

  const validation = validateAmount(input, baseCurrency, decimals);
  const validatedAmount = validation.valid ? validation.amount : null;

  useEffect(() => {
    if (!validatedAmount) {
      return;
    }

    let isMounted = true;
    const timer = setTimeout(() => {
      setIsCalculating(true);
      fetch("/api/currency/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseAmount: validatedAmount,
          baseCurrency,
          quoteCurrency,
        }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!isMounted) return;
          if (data?.quote) {
            setConvertedAmount(data.quote.convertedAmount);
          }
          setIsCalculating(false);
        })
        .catch(() => {
          if (!isMounted) return;
          setIsCalculating(false);
        });
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [validatedAmount, baseCurrency, quoteCurrency]);

  return (
    <>
      <div className="flex flex-col items-center gap-3">
        <div className="w-full rounded-2xl border border-line bg-canvas p-4 sm:p-5">
          <div className="flex items-baseline justify-between gap-3 text-[13px] text-ink-muted">
            <label htmlFor={id}>Amount to estimate</label>
            <span>Display currency</span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <input
              id={id}
              inputMode="decimal"
              autoComplete="off"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              aria-invalid={validation.valid ? undefined : true}
              aria-describedby={validation.valid ? undefined : errorId}
              className="tabular min-h-14 w-full min-w-0 rounded-control border border-line bg-surface px-3 font-mono text-2xl text-ink transition-colors duration-150 hover:border-ink-subtle focus:border-primary-hover aria-invalid:border-danger sm:text-[32px]"
            />
            <span className="shrink-0 font-mono text-lg font-medium">{baseCurrency}</span>
          </div>
          {validation.valid ? null : (
            <p id={errorId} className="mt-2 text-[13px] text-danger">
              {validation.message}
            </p>
          )}
        </div>
        <span className="grid size-9 place-items-center rounded-full bg-surface-muted text-ink-muted">
          <ArrowDown aria-hidden className="size-4" />
        </span>
        <div className="w-full rounded-2xl border border-line bg-surface-raised p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-ink-muted">
            <span id={`${id}-estimate`}>Estimated local amount</span>
            <Badge>Indicative estimate</Badge>
          </div>
          <output
            aria-labelledby={`${id}-estimate`}
            className="tabular mt-2 flex flex-wrap items-baseline justify-between gap-x-3 font-mono text-[28px] font-medium leading-tight text-lavender [overflow-wrap:anywhere] sm:text-4xl"
          >
            <span className="min-w-0">
              {isCalculating ? "..." : convertedAmount ? formatDecimal(convertedAmount) : "—"}
            </span>
            <span className="text-lg text-ink">{quoteCurrency}</span>
          </output>
        </div>
      </div>
      {rateInfo ? (
        <dl className="grid gap-2 text-[13px]">
          <QuoteRow term="Source">{rateInfo.source}</QuoteRow>
          <QuoteRow term="As of">
            <time dateTime={rateInfo.asOf}>{formatDateTimeUtc(rateInfo.asOf)}</time>
          </QuoteRow>
        </dl>
      ) : null}
      <p className="text-[13px] text-ink-muted">
        This is an estimate, not a guaranteed final conversion rate. The final amount may differ.
      </p>
    </>
  );
}

function QuoteRow({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-ink-subtle">{term}</dt>
      <dd className="min-w-0 text-right text-ink">{children}</dd>
    </div>
  );
}

function ConversionSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <p className="sr-only" role="status">
        Loading exchange rate
      </p>
      <Skeleton className="h-28 w-full rounded-2xl" />
      <Skeleton className="h-28 w-full rounded-2xl" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

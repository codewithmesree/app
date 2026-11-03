"use client";

import { ArrowDown, QrCode, Store } from "lucide-react";
import { useId, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrency, type CurrencyCode } from "@/features/currency/currencies";
import type { RateStatus } from "@/features/currency/currency-types";
import { getSampleQuote, getSampleRate } from "@/features/currency/sample-quote";
import { formatDateTimeUtc } from "@/lib/format-date";
import { formatDecimal } from "@/lib/format-money";
import { validateAmount } from "@/lib/validation/amount";

type IndicativeRateCardProps = {
  status: RateStatus;
  baseCurrency: CurrencyCode;
  quoteCurrency: CurrencyCode;
};

export function IndicativeRateCard({ status, baseCurrency, quoteCurrency }: IndicativeRateCardProps) {
  return (
    <Card aria-labelledby="rate-heading" aria-busy={status === "loading"} className="flex h-full flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line pb-4">
        <h2 id="rate-heading" className="label-mono text-ink-muted">
          Indicative conversion
        </h2>
        {status === "ready" ? (
          <p className="font-mono text-[13px] text-lavender">
            Sample rate: 1 {baseCurrency} = {getSampleRate(baseCurrency, quoteCurrency)} {quoteCurrency}
          </p>
        ) : null}
      </div>
      {status === "loading" ? <ConversionSkeleton /> : null}
      {status === "unavailable" ? (
        <Alert tone="warning" title="Rate unavailable">
          We couldn&rsquo;t refresh the exchange rate, so no estimate is shown. Try again once the rate source is back.
        </Alert>
      ) : null}
      {status === "ready" ? <ConversionForm baseCurrency={baseCurrency} quoteCurrency={quoteCurrency} /> : null}
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

function ConversionForm({ baseCurrency, quoteCurrency }: Omit<IndicativeRateCardProps, "status">) {
  const { decimals } = getCurrency(baseCurrency);
  const [input, setInput] = useState(decimals === 0 ? "25000" : "250.00");
  const id = useId();
  const errorId = `${id}-error`;

  const validation = validateAmount(input, baseCurrency, decimals);
  const quote = validation.valid ? getSampleQuote(validation.amount, baseCurrency, quoteCurrency) : null;

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
            <span className="min-w-0">{quote ? formatDecimal(quote.convertedAmount) : "—"}</span>
            <span className="text-lg text-ink">{quoteCurrency}</span>
          </output>
        </div>
      </div>
      {quote ? (
        <dl className="grid gap-2 text-[13px]">
          <QuoteRow term="Fees">Unavailable until a provider confirms them</QuoteRow>
          <QuoteRow term="Source">{quote.source}</QuoteRow>
          <QuoteRow term="As of">
            <time dateTime={quote.asOf}>{formatDateTimeUtc(quote.asOf)}</time>
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

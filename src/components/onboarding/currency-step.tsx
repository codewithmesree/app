"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { FilterPills } from "@/components/ui/filter-pills";
import { SearchField } from "@/components/ui/search-field";
import { SelectionOption } from "@/components/ui/selection-option";
import { CURRENCY_FILTERS, findCurrencies, getCurrency, type CurrencyCode, type CurrencyFilter } from "@/features/currency/currencies";
import { getCountry, type CountryCode } from "@/features/travel/countries";
import { ResultCount } from "./result-count";
import { StepIntro } from "./step-intro";

type CurrencyStepProps = {
  homeCountry: CountryCode;
  value: CurrencyCode;
  onSelect: (currency: CurrencyCode) => void;
};

export function CurrencyStep({ homeCountry, value, onSelect }: CurrencyStepProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CurrencyFilter>("all");

  const homeCurrency = getCountry(homeCountry).currency;
  const currencies = findCurrencies(query, filter);
  const selected = getCurrency(value);

  return (
    <div className="flex flex-col gap-6">
      <StepIntro
        focusOnMount
        eyebrow="Display currency"
        title="Your preferred currency"
        description="Estimates and totals across GlobalPay will be shown in this currency. It doesn't change where you live or travel."
      />
      <SearchField label="Search currencies" placeholder="Search country, symbol or code" value={query} onChange={setQuery} />
      <FilterPills label="Filter currencies" options={CURRENCY_FILTERS} value={filter} onChange={setFilter} />
      <fieldset className="flex min-w-0 flex-col gap-3">
        <legend className="sr-only">Display currency</legend>
        {currencies.map((currency) => {
          const checked = value === currency.code;
          return (
            <SelectionOption
              key={currency.code}
              type="radio"
              name="display-currency"
              value={currency.code}
              checked={checked}
              onChange={() => onSelect(currency.code)}
              leading={
                <span
                  aria-hidden
                  className={`grid size-12 shrink-0 place-items-center rounded-xl font-mono text-lg ${
                    checked ? "bg-primary-soft text-lavender" : "bg-surface-muted text-ink"
                  }`}
                >
                  {currency.symbol}
                </span>
              }
              title={
                <span className="flex flex-wrap items-center gap-x-2">
                  <span className="font-mono">{currency.code}</span>
                  <span className="rounded-md bg-surface-muted px-1.5 font-mono text-xs text-ink-muted">{currency.areaCode}</span>
                  {currency.code === homeCurrency ? <span className="text-xs text-lavender">Home currency</span> : null}
                </span>
              }
              description={<span className="font-sans">{currency.name}</span>}
            />
          );
        })}
        <ResultCount count={currencies.length} noun="currency" emptyMessage="No currency matches that search." />
      </fieldset>
      <p className="rounded-control border border-line bg-surface px-4 py-3 font-mono text-[13px] text-ink-muted">
        Display currency <strong className="font-semibold text-ink">{selected.code} ({selected.symbol})</strong>
      </p>
      <Alert title="Estimates only">Conversions are indicative. The final amount may differ.</Alert>
    </div>
  );
}

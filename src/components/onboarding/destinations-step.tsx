"use client";

import { X } from "lucide-react";
import { useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { CountryFlag } from "@/components/ui/country-flag";
import { FilterPills } from "@/components/ui/filter-pills";
import { SearchField } from "@/components/ui/search-field";
import { SelectionOption } from "@/components/ui/selection-option";
import { getSampleRate } from "@/features/currency/sample-quote";
import { findCountries, getCountry, REGION_FILTERS, type CountryCode, type RegionFilter } from "@/features/travel/countries";
import { ResultCount } from "./result-count";
import { StepIntro } from "./step-intro";

type DestinationsStepProps = {
  homeCountry: CountryCode;
  value: CountryCode[];
  onToggle: (country: CountryCode) => void;
};

export function DestinationsStep({ homeCountry, value, onToggle }: DestinationsStepProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<RegionFilter>("popular");
  const chipsRef = useRef<HTMLDivElement>(null);

  const home = getCountry(homeCountry);
  const countries = findCountries(query, filter).filter((country) => country.code !== homeCountry);

  function removeChip(country: CountryCode) {
    onToggle(country);
    // The focused chip is about to disappear; keep the keyboard position nearby.
    chipsRef.current?.focus();
  }

  return (
    <div className="flex flex-col gap-6">
      <StepIntro
        focusOnMount
        eyebrow="Destinations"
        title="Where are you travelling to?"
        description="Choose one or more destinations. We'll show indicative estimates in their local currencies."
      />
      <div ref={chipsRef} tabIndex={-1} className="flex flex-col gap-2 rounded-control outline-none">
        <p className="label-mono text-ink-muted">Selected destinations</p>
        {value.length === 0 ? (
          <p className="text-sm text-ink-muted">None selected yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {value.map((code) => {
              const country = getCountry(code);
              return (
                <li key={code}>
                  <span className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface-raised pl-3 pr-1 text-sm">
                    <CountryFlag code={code} className="h-3.5 w-5" />
                    {country.name} <span className="font-mono text-[13px] text-ink-muted">({country.currency})</span>
                    <button
                      type="button"
                      aria-label={`Remove ${country.name}`}
                      onClick={() => removeChip(code)}
                      className="grid size-9 place-items-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-surface-muted hover:text-ink"
                    >
                      <X aria-hidden className="size-4" />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <SearchField label="Search destinations" placeholder="Search country or currency code" value={query} onChange={setQuery} />
      <FilterPills label="Filter destinations by region" options={REGION_FILTERS} value={filter} onChange={setFilter} />
      <fieldset className="flex min-w-0 flex-col gap-3">
        <legend className="sr-only">Destinations</legend>
        {countries.map((country) => (
          <SelectionOption
            key={country.code}
            type="checkbox"
            name="destinations"
            value={country.code}
            checked={value.includes(country.code)}
            onChange={() => onToggle(country.code)}
            leading={
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-surface-muted">
                <CountryFlag code={country.code} />
              </span>
            }
            title={
              <span className="flex flex-wrap items-center gap-x-2">
                {country.name}
                <span className="rounded-md bg-surface-muted px-1.5 font-mono text-xs text-ink-muted">{country.currency}</span>
              </span>
            }
            description={
              country.currency === home.currency
                ? `Same currency as ${home.name}`
                : `1 ${home.currency} ≈ ${getSampleRate(home.currency, country.currency)} ${country.currency}`
            }
          />
        ))}
        <ResultCount count={countries.length} noun="destination" emptyMessage="No destination matches. Try another search or region." />
      </fieldset>
      <Alert title="Sample rates">These fixed rates are for the demo only. They aren&rsquo;t live or market rates.</Alert>
    </div>
  );
}

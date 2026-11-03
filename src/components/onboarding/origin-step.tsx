"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { CountryFlag } from "@/components/ui/country-flag";
import { SearchField } from "@/components/ui/search-field";
import { SelectionOption } from "@/components/ui/selection-option";
import { getCurrency } from "@/features/currency/currencies";
import { findCountries, type CountryCode } from "@/features/travel/countries";
import { ResultCount } from "./result-count";
import { StepIntro } from "./step-intro";

type OriginStepProps = {
  focusOnMount: boolean;
  value: CountryCode | null;
  onSelect: (country: CountryCode) => void;
};

export function OriginStep({ focusOnMount, value, onSelect }: OriginStepProps) {
  const [query, setQuery] = useState("");
  const countries = findCountries(query);

  return (
    <div className="flex flex-col gap-6">
      <StepIntro
        focusOnMount={focusOnMount}
        eyebrow="Home country"
        title="Where are you travelling from?"
        description="This is where you live. We'll use it to suggest a display currency, which you can change."
      />
      <SearchField label="Search home countries" placeholder="Search country or currency code" value={query} onChange={setQuery} />
      <fieldset className="flex min-w-0 flex-col gap-3">
        <legend className="label-mono mb-3 text-ink-muted">Demonstration countries</legend>
        {countries.map((country) => {
          const currency = getCurrency(country.currency);
          return (
            <SelectionOption
              key={country.code}
              type="radio"
              name="home-country"
              value={country.code}
              checked={value === country.code}
              onChange={() => onSelect(country.code)}
              leading={
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-surface-muted">
                  <CountryFlag code={country.code} />
                </span>
              }
              title={country.name}
              description={`${currency.code} (${currency.symbol})`}
            />
          );
        })}
        <ResultCount count={countries.length} noun="country" emptyMessage="No demonstration country matches that search." />
      </fieldset>
      <Alert title="Prototype only">
        Choosing a country doesn&rsquo;t connect to a bank or payment network there. Test payments use PayPal Sandbox.
      </Alert>
    </div>
  );
}

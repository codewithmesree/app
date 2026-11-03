"use client";

import { useState, type ReactNode } from "react";
import { Reveal } from "@/components/motion/reveal";
import { ButtonLink } from "@/components/ui/button";
import { FilterPills } from "@/components/ui/filter-pills";
import { PageHeader } from "@/components/ui/page-header";
import type { RateStatus } from "@/features/currency/currency-types";
import { getCountry } from "@/features/travel/countries";
import { SAMPLE_PREFERENCES, useTravellerPreferences } from "@/features/travel/traveller-preferences";
import { IndicativeRateCard } from "./indicative-rate-card";
import { SampleMerchantsCard } from "./sample-merchants-card";
import { TravelInfoCard } from "./travel-info-card";
import { BankLinkingStatusBanner } from "@/components/bank-linking/bank-linking-status-banner";

type DashboardWorkspaceProps = {
  rateStatus: RateStatus;
  notice: ReactNode;
};

/** Everything that depends on the traveller's preferences and current destination. */
export function DashboardWorkspace({ rateStatus, notice }: DashboardWorkspaceProps) {
  const { preferences } = useTravellerPreferences();
  const { homeCountry, destinations, displayCurrency } = preferences ?? SAMPLE_PREFERENCES;
  const [selected, setSelected] = useState(destinations[0]);

  // Preferences can change in Settings, which may remove the selected destination.
  const destination = destinations.includes(selected) ? selected : destinations[0];
  const { name, currency } = getCountry(destination);

  return (
    <>
      <PageHeader
        eyebrow={`${name} · demonstration corridor`}
        title="Travel Payments"
        description={
          preferences
            ? `Estimate purchases in ${name} from your ${displayCurrency} display currency, then try a PayPal Sandbox test payment.`
            : "Showing a sample trip. Set up your own to see estimates for your destinations."
        }
        aside={
          preferences ? (
            <p className="flex items-center gap-2 font-mono text-[13px] text-ink-muted">
              <span aria-hidden className="size-2 rounded-full bg-lavender" />
              Travelling from {getCountry(homeCountry).name}
            </p>
          ) : (
            <ButtonLink href="/onboarding" variant="secondary">
              Set up your trip
            </ButtonLink>
          )
        }
      />
      {destinations.length > 1 ? (
        <FilterPills
          label="Current destination"
          options={destinations.map((code) => ({ id: code, label: getCountry(code).name }))}
          value={destination}
          onChange={setSelected}
        />
      ) : null}
      {notice}
      <BankLinkingStatusBanner />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
        <Reveal className="lg:col-span-7">
          <IndicativeRateCard
            key={`${displayCurrency}-${currency}`}
            status={rateStatus}
            baseCurrency={displayCurrency}
            quoteCurrency={currency}
          />
        </Reveal>
        <div className="flex flex-col gap-4 lg:col-span-5 lg:gap-6">
          <Reveal order={1}>
            <TravelInfoCard country={destination} />
          </Reveal>
          <Reveal order={2}>
            <SampleMerchantsCard country={destination} />
          </Reveal>
        </div>
      </div>
    </>
  );
}

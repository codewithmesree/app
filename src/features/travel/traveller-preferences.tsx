"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { CurrencyCode } from "@/features/currency/currencies";
import type { CountryCode } from "./countries";

/** Three separate choices: where you live, where you're going, how amounts display. */
export type TravellerPreferences = {
  homeCountry: CountryCode;
  destinations: CountryCode[];
  displayCurrency: CurrencyCode;
};

/** Stands in on the dashboard until the traveller finishes onboarding; always labelled as a sample. */
export const SAMPLE_PREFERENCES: TravellerPreferences = {
  homeCountry: "US",
  destinations: ["JP"],
  displayCurrency: "USD",
};

type PreferencesContextValue = {
  /** `null` until onboarding completes. */
  preferences: TravellerPreferences | null;
  savePreferences: (preferences: TravellerPreferences) => void;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

/**
 * Holds preferences in memory for the current page load only, so a refresh
 * clears them. Durable storage is a later decision (PRD FR-02, api-contract.md
 * section 2); browser state must never become an authority for payments.
 */
export function TravellerPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, savePreferences] = useState<TravellerPreferences | null>(null);
  const value = useMemo(() => ({ preferences, savePreferences }), [preferences]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function useTravellerPreferences(): PreferencesContextValue {
  const value = useContext(PreferencesContext);
  if (!value) {
    throw new Error("useTravellerPreferences must be used within TravellerPreferencesProvider.");
  }
  return value;
}

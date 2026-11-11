"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CURRENCIES } from "@/features/currency/currencies";
import { COUNTRIES, type Country, type CountryCode } from "./countries";
import type { CurrencyCode } from "@/features/currency/currencies";

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
  preferences: TravellerPreferences | null;
  savePreferences: (preferences: TravellerPreferences) => Promise<void>;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parsePreferences(value: unknown): TravellerPreferences | null {
  if (value === null) return null;
  if (!isRecord(value) || !Array.isArray(value.destinations)) {
    throw new Error("The saved traveller preferences response was invalid.");
  }

  const homeCountry = COUNTRIES.find((country) => country.code === value.homeCountry);
  const displayCurrency = CURRENCIES.find((currency) => currency.code === value.displayCurrency);
  const destinations = value.destinations.map((destination) =>
    typeof destination === "string"
      ? COUNTRIES.find((country) => country.code === destination)
      : undefined
  );
  const validDestinations = destinations.filter(
    (country): country is Country => country !== undefined
  );

  if (!homeCountry || !displayCurrency || validDestinations.length !== destinations.length) {
    throw new Error("The saved traveller preferences contain unsupported values.");
  }

  return {
    homeCountry: homeCountry.code,
    displayCurrency: displayCurrency.code,
    destinations: validDestinations.map((country) => country.code),
  };
}

export function TravellerPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<TravellerPreferences | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/preferences", {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as {
          preferences?: unknown;
          error?: { message?: unknown };
        };
        if (!response.ok) {
          throw new Error(
            typeof payload.error?.message === "string"
              ? payload.error.message
              : "Saved traveller preferences could not be restored."
          );
        }
        setPreferences(parsePreferences(payload.preferences));
        setLoadError(null);
        setLoaded(true);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLoadError(
          error instanceof Error
            ? error.message
            : "Saved traveller preferences could not be restored."
        );
      });

    return () => controller.abort();
  }, [retryCount]);

  const savePreferences = useCallback(async (nextPreferences: TravellerPreferences) => {
    const response = await fetch("/api/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(nextPreferences),
    });
    const payload = (await response.json()) as {
      preferences?: unknown;
      error?: { message?: unknown };
    };
    if (!response.ok) {
      throw new Error(
        typeof payload.error?.message === "string"
          ? payload.error.message
          : "Traveller preferences could not be saved."
      );
    }

    const savedPreferences = parsePreferences(payload.preferences);
    if (!savedPreferences) {
      throw new Error("The saved traveller preferences response was invalid.");
    }
    setPreferences(savedPreferences);
  }, []);

  const value = useMemo(() => ({ preferences, savePreferences }), [preferences, savePreferences]);

  if (!loaded) {
    return (
      <main className="mx-auto grid min-h-dvh max-w-xl place-items-center px-6">
        {loadError ? (
          <div className="flex w-full flex-col gap-4">
            <Alert tone="danger" title="Could not restore trip preferences">
              {loadError}
            </Alert>
            <Button
              variant="primary"
              onClick={() => {
                setLoadError(null);
                setRetryCount((count) => count + 1);
              }}
            >
              Retry
            </Button>
          </div>
        ) : (
          <p role="status" className="text-sm text-ink-muted">
            Restoring your trip preferences…
          </p>
        )}
      </main>
    );
  }

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function useTravellerPreferences(): PreferencesContextValue {
  const value = useContext(PreferencesContext);
  if (!value) {
    throw new Error("useTravellerPreferences must be used within TravellerPreferencesProvider.");
  }
  return value;
}

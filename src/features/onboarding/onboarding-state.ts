import type { CurrencyCode } from "@/features/currency/currencies";
import { getCountry, type CountryCode } from "@/features/travel/countries";
import type { TravellerPreferences } from "@/features/travel/traveller-preferences";

export type OnboardingStep = 1 | 2 | 3;

export const STEP_NAMES: Record<OnboardingStep, string> = {
  1: "Home country",
  2: "Destinations",
  3: "Display currency",
};

export type OnboardingState = {
  step: OnboardingStep;
  /** Stays false until the first step change, so opening the flow doesn't steal focus. */
  hasMoved: boolean;
  homeCountry: CountryCode | null;
  destinations: CountryCode[];
  /** `null` until chosen; the home currency is only a starting suggestion. */
  displayCurrency: CurrencyCode | null;
  error: string | null;
};

export type OnboardingAction =
  | { type: "select-home"; country: CountryCode }
  | { type: "toggle-destination"; country: CountryCode }
  | { type: "select-currency"; currency: CurrencyCode }
  | { type: "show-error"; message: string }
  | { type: "next" }
  | { type: "back" };

export function createOnboardingState(saved: TravellerPreferences | null): OnboardingState {
  return {
    step: 1,
    hasMoved: false,
    homeCountry: saved?.homeCountry ?? null,
    destinations: saved?.destinations ?? [],
    displayCurrency: saved?.displayCurrency ?? null,
    error: null,
  };
}

export function onboardingReducer(state: OnboardingState, action: OnboardingAction): OnboardingState {
  switch (action.type) {
    case "select-home":
      return {
        ...state,
        homeCountry: action.country,
        // A trip goes somewhere else, so the new home can't stay a destination.
        destinations: state.destinations.filter((code) => code !== action.country),
        error: null,
      };
    case "toggle-destination":
      return {
        ...state,
        destinations: state.destinations.includes(action.country)
          ? state.destinations.filter((code) => code !== action.country)
          : [...state.destinations, action.country],
        error: null,
      };
    case "select-currency":
      return { ...state, displayCurrency: action.currency, error: null };
    case "show-error":
      return { ...state, error: action.message };
    case "next":
      return state.step === 3 ? state : { ...state, step: (state.step + 1) as OnboardingStep, hasMoved: true, error: null };
    case "back":
      return state.step === 1 ? state : { ...state, step: (state.step - 1) as OnboardingStep, hasMoved: true, error: null };
  }
}

export function getStepError(state: OnboardingState): string | null {
  if (state.step === 1 && !state.homeCountry) return "Choose your home country to continue.";
  if (state.step === 2 && state.destinations.length === 0) return "Choose at least one destination to continue.";
  return null;
}

export function getDisplayCurrency(state: OnboardingState): CurrencyCode | null {
  return state.displayCurrency ?? (state.homeCountry ? getCountry(state.homeCountry).currency : null);
}

export function toPreferences(state: OnboardingState): TravellerPreferences | null {
  const displayCurrency = getDisplayCurrency(state);
  if (!state.homeCountry || state.destinations.length === 0 || !displayCurrency) {
    return null;
  }
  return { homeCountry: state.homeCountry, destinations: state.destinations, displayCurrency };
}

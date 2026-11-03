"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useReducer, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  createOnboardingState,
  getDisplayCurrency,
  getStepError,
  onboardingReducer,
  toPreferences,
  type OnboardingState,
} from "@/features/onboarding/onboarding-state";
import { getCountry } from "@/features/travel/countries";
import { useTravellerPreferences } from "@/features/travel/traveller-preferences";
import { CurrencyStep } from "./currency-step";
import { DestinationsStep } from "./destinations-step";
import { OnboardingProgress } from "./onboarding-progress";
import { OnboardingSummary } from "./onboarding-summary";
import { OriginStep } from "./origin-step";

const BACK_CLASS =
  "inline-flex min-h-11 items-center gap-2 rounded-control px-2 text-sm font-medium text-ink-muted transition-colors duration-150 hover:text-ink";

function getContinueLabel(state: OnboardingState): string {
  if (state.step === 1) {
    return state.homeCountry ? `Set ${getCountry(state.homeCountry).name} as home` : "Continue";
  }
  if (state.step === 2) {
    const count = state.destinations.length;
    return count === 0 ? "Continue" : `Continue (${count} ${count === 1 ? "destination" : "destinations"} selected)`;
  }
  return "Complete setup";
}

export function OnboardingFlow() {
  const router = useRouter();
  const { preferences, savePreferences } = useTravellerPreferences();
  const [state, dispatch] = useReducer(onboardingReducer, preferences, createOnboardingState);

  function handleContinue() {
    const message = getStepError(state);
    if (message) {
      dispatch({ type: "show-error", message });
      return;
    }
    if (state.step < 3) {
      dispatch({ type: "next" });
      return;
    }
    const completed = toPreferences(state);
    if (completed) {
      savePreferences(completed);
      router.push("/dashboard");
    }
  }

  let step: ReactNode;
  if (state.step === 1) {
    step = (
      <OriginStep
        focusOnMount={state.hasMoved}
        value={state.homeCountry}
        onSelect={(country) => dispatch({ type: "select-home", country })}
      />
    );
  } else if (state.step === 2) {
    step = (
      <DestinationsStep
        homeCountry={state.homeCountry!}
        value={state.destinations}
        onToggle={(country) => dispatch({ type: "toggle-destination", country })}
      />
    );
  } else {
    step = (
      <CurrencyStep
        homeCountry={state.homeCountry!}
        value={getDisplayCurrency(state)!}
        onSelect={(currency) => dispatch({ type: "select-currency", currency })}
      />
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 sm:px-6 lg:px-8">
      <header className="flex min-h-16 items-center justify-between gap-4">
        {state.step === 1 ? (
          <Link href="/" className={BACK_CLASS}>
            <ArrowLeft aria-hidden className="size-5" />
            Back
          </Link>
        ) : (
          <button type="button" onClick={() => dispatch({ type: "back" })} className={BACK_CLASS}>
            <ArrowLeft aria-hidden className="size-5" />
            Back
          </button>
        )}
        <p className="label-mono text-ink-muted">GlobalPay</p>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-8 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-12 lg:pb-10 lg:pt-4">
        <div className="flex flex-col gap-6 lg:sticky lg:top-6 lg:self-start">
          <OnboardingProgress step={state.step} />
          <OnboardingSummary
            homeCountry={state.homeCountry}
            destinations={state.destinations}
            displayCurrency={getDisplayCurrency(state)}
          />
        </div>

        <main className="flex min-w-0 flex-col">
          <motion.div
            key={state.step}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex-1"
          >
            {step}
          </motion.div>

          <div className="sticky bottom-0 z-10 -mx-4 mt-6 flex flex-col gap-2 border-t border-line bg-canvas px-4 pb-[calc(1rem+var(--gp-safe-bottom))] pt-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
            {state.error ? (
              <p role="alert" className="text-sm font-medium text-danger">
                {state.error}
              </p>
            ) : null}
            <Button variant="accent" onClick={handleContinue} className="min-h-14 w-full text-base">
              {getContinueLabel(state)}
              <ArrowRight aria-hidden className="size-5 shrink-0" />
            </Button>
            {state.step === 3 ? (
              <p className="text-center text-[13px] text-ink-muted">You can change this later in Settings.</p>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}

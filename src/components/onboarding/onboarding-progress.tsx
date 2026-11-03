import { STEP_NAMES, type OnboardingStep } from "@/features/onboarding/onboarding-state";

const TOTAL_STEPS = 3;

export function OnboardingProgress({ step }: { step: OnboardingStep }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="label-mono flex flex-wrap justify-between gap-x-4 gap-y-1">
        <span className="text-lavender">
          Step {step} of {TOTAL_STEPS}
        </span>
        <span className="text-ink-muted">{STEP_NAMES[step]}</span>
      </p>
      <div
        role="progressbar"
        aria-label="Setup progress"
        aria-valuemin={1}
        aria-valuemax={TOTAL_STEPS}
        aria-valuenow={step}
        aria-valuetext={`Step ${step} of ${TOTAL_STEPS}: ${STEP_NAMES[step]}`}
        className="h-1 overflow-hidden rounded-full bg-surface-muted"
      >
        <div
          className="h-full rounded-full bg-lavender transition-[width] duration-200 ease-out"
          style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
        />
      </div>
    </div>
  );
}

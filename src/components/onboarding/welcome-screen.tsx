import { ArrowRight, FlaskConical } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { ButtonLink } from "@/components/ui/button";

export function WelcomeScreen() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center overflow-hidden px-6 pb-[calc(2.5rem+var(--gp-safe-bottom))] pt-10 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_45%_at_0%_45%,rgb(139_92_246/0.2),transparent_70%),radial-gradient(60%_40%_at_100%_0%,rgb(139_92_246/0.1),transparent_70%)]"
      />
      <Reveal className="relative">
        <p className="label-mono inline-flex items-center gap-2.5 rounded-full border border-line bg-surface px-4 py-2 text-lavender">
          <span aria-hidden className="size-2 rounded-full bg-lavender ring-4 ring-lavender/25" />
          AI-powered travel payments
        </p>
      </Reveal>
      <div className="relative flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 py-12">
        <Reveal order={1}>
          <h1 className="text-[56px] font-semibold leading-none tracking-[-0.04em] sm:text-7xl lg:text-8xl">GlobalPay</h1>
        </Reveal>
        <Reveal order={2}>
          <p className="text-[32px] font-medium leading-[1.3] tracking-tight sm:text-[40px]">
            <span className="block">Your world.</span>
            <span className="block">Your payments.</span>
            <span className="block text-lavender">Simplified.</span>
          </p>
        </Reveal>
        <Reveal order={3}>
          <p className="max-w-lg text-base text-ink-muted sm:text-lg">
            A prototype that helps travellers understand paying abroad, with indicative exchange rates, sample merchants
            and an AI assistant.
          </p>
        </Reveal>
      </div>
      <Reveal order={4} className="relative flex flex-col items-center gap-5">
        <ButtonLink href="/onboarding" variant="accent" className="group min-h-14 px-10 text-base">
          Get Started
          <ArrowRight aria-hidden className="size-5 transition-transform duration-150 group-hover:translate-x-0.5" />
        </ButtonLink>
        <p className="flex max-w-sm items-start gap-2 text-left text-[13px] text-warning">
          <FlaskConical aria-hidden className="mt-0.5 size-4 shrink-0" />
          Demo mode: PayPal Sandbox is used. No real money will move.
        </p>
      </Reveal>
    </main>
  );
}

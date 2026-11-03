import { FlaskConical } from "lucide-react";
import type { ReactNode } from "react";
import type { CurrencyCode } from "@/features/currency/currencies";
import { getCountry, type CountryCode } from "@/features/travel/countries";

type OnboardingSummaryProps = {
  homeCountry: CountryCode | null;
  destinations: CountryCode[];
  displayCurrency: CurrencyCode | null;
};

/** Desktop-only recap; each step already shows its own selection on small screens. */
export function OnboardingSummary({ homeCountry, destinations, displayCurrency }: OnboardingSummaryProps) {
  return (
    <aside aria-label="Your choices so far" className="hidden flex-col gap-6 lg:flex">
      <dl className="flex flex-col gap-4 border-t border-line pt-6">
        <Row term="Home country">{homeCountry ? getCountry(homeCountry).name : null}</Row>
        <Row term="Destinations">
          {destinations.length > 0 ? destinations.map((code) => getCountry(code).name).join(", ") : null}
        </Row>
        <Row term="Display currency">{displayCurrency}</Row>
      </dl>
      <p className="flex items-start gap-2 text-[13px] text-warning">
        <FlaskConical aria-hidden className="mt-0.5 size-4 shrink-0" />
        Demo mode: PayPal Sandbox is used. No real money will move.
      </p>
    </aside>
  );
}

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div>
      <dt className="label-mono text-ink-subtle">{term}</dt>
      <dd className={`mt-1 text-sm ${children ? "font-medium text-ink" : "text-ink-muted"}`}>{children ?? "Not set"}</dd>
    </div>
  );
}

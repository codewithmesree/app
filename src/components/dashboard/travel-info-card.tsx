import { Lightbulb } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getCountry, type CountryCode } from "@/features/travel/countries";
import { getPaymentGuidance } from "@/features/travel/payment-guidance";

export function TravelInfoCard({ country }: { country: CountryCode }) {
  const { name } = getCountry(country);
  const { dcc, local } = getPaymentGuidance(country);

  return (
    <Card aria-labelledby="travel-info-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 id="travel-info-heading" className="label-mono flex items-center gap-2 text-lavender">
          <Lightbulb aria-hidden className="size-4" />
          Travel payment info
        </h2>
        <span className="font-mono text-[13px] text-ink-muted">{name}</span>
      </div>
      <p className="text-sm leading-relaxed">{dcc}</p>
      {local ? (
        <div className="border-t border-line pt-4 text-[13px]">
          <p className="font-medium">{local.title}</p>
          <p className="mt-1 text-ink-muted">{local.note}</p>
        </div>
      ) : null}
      <p className="text-[13px] text-ink-subtle">General guidance. Check with the merchant or your card provider.</p>
    </Card>
  );
}

import { MerchantCategoryIcon } from "@/components/merchants/merchant-category-icon";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getSampleMerchants } from "@/features/merchants/sample-merchants";
import type { CountryCode } from "@/features/travel/countries";

export function SampleMerchantsCard({ country }: { country: CountryCode }) {
  const merchants = getSampleMerchants(country);

  return (
    <Card aria-labelledby="sample-merchants-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="sample-merchants-heading" className="label-mono text-ink-muted">
          Sample merchants
        </h2>
        <Badge>Sample data</Badge>
      </div>
      <ul className="flex flex-col gap-2">
        {merchants.map((merchant) => (
          <li key={merchant.id} className="flex items-center gap-3 rounded-control border border-line bg-canvas px-3 py-2.5">
            <MerchantCategoryIcon category={merchant.category} className="size-4 shrink-0 text-ink-muted" />
            <span className="min-w-0 flex-1 text-sm">{merchant.name}</span>
            <span className="shrink-0 font-mono text-xs text-ink-muted">{merchant.place}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

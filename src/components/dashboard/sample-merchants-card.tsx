"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MerchantCategoryIcon } from "@/components/merchants/merchant-category-icon";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { CountryCode } from "@/features/travel/countries";
import type { SafeMerchantSummary } from "@/lib/merchants/merchant-service";
import type { MerchantCategory } from "@/features/merchants/merchant-types";

export function SampleMerchantsCard({ country }: { country: CountryCode }) {
  // The parent keys this component on `country`, so it remounts on destination change.
  // Therefore useState(true) always starts fresh — no need to reset inside the effect.
  const [merchants, setMerchants] = useState<SafeMerchantSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    fetch(`/api/merchants?countryCode=${country}&limit=4`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted) return;
        setMerchants(data?.items || []);
        setIsLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setMerchants([]);
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [country]);

  return (
    <Card aria-labelledby="sample-merchants-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="sample-merchants-heading" className="label-mono text-ink-muted">
          Demo merchants
        </h2>
        <div className="flex items-center gap-2">
          <Badge tone="neutral">Catalogue</Badge>
          <Link
            href="/merchants"
            className="inline-flex min-h-11 items-center rounded px-1 text-xs font-medium text-primary-hover underline-offset-4 hover:underline"
          >
            All merchants
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-control border border-line bg-canvas px-3 py-2.5">
              <Skeleton className="size-4 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      ) : null}

      {!isLoading && merchants.length === 0 ? (
        <p className="py-2 text-xs text-ink-muted">
          No demo merchants available for this destination.
        </p>
      ) : null}

      {!isLoading && merchants.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {merchants.map((merchant) => (
            <li key={merchant.id}>
              <Link
                href={`/pay?merchantId=${merchant.slug || merchant.id}`}
                className="group flex items-center gap-3 rounded-control border border-line bg-canvas px-3 py-2.5 transition-colors duration-150 hover:border-lavender hover:bg-surface-muted"
              >
                <MerchantCategoryIcon
                  category={merchant.category.toLowerCase() as MerchantCategory}
                  className="size-4 shrink-0 text-ink-muted group-hover:text-ink"
                />
                <span className="min-w-0 flex-1 text-sm group-hover:text-ink">{merchant.name}</span>
                <span className="shrink-0 font-mono text-xs text-ink-muted group-hover:text-ink">
                  {merchant.displayCurrency}
                </span>
                <ArrowRight aria-hidden className="size-3 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

"use client";

import {
  AlertCircle,
  ArrowRight,
  Filter,
  LoaderCircle,
  Lock,
  RefreshCw,
  ShieldCheck,
  Store,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MerchantCategoryIcon } from "@/components/merchants/merchant-category-icon";
import { Reveal } from "@/components/motion/reveal";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FilterPills } from "@/components/ui/filter-pills";
import { PageHeader } from "@/components/ui/page-header";
import { useBankLinking } from "@/features/bank-linking/bank-linking-context";
import type { MerchantCategory } from "@/features/merchants/merchant-types";
import { getCountry, type CountryCode } from "@/features/travel/countries";
import {
  SAMPLE_PREFERENCES,
  useTravellerPreferences,
} from "@/features/travel/traveller-preferences";
import type { SafeMerchantSummary } from "@/lib/merchants/merchant-service";

const CATEGORY_OPTIONS: { id: string; label: string }[] = [
  { id: "all", label: "All Categories" },
  { id: "dining", label: "Dining" },
  { id: "transit", label: "Transit" },
  { id: "hotel", label: "Hotel" },
  { id: "retail", label: "Retail" },
];

export function MerchantsListClient() {
  const { preferences } = useTravellerPreferences();
  const { destinations } = preferences ?? SAMPLE_PREFERENCES;
  const { isPaymentEligible, state } = useBankLinking();

  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(
    destinations[0] ?? "JP"
  );
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const [merchants, setMerchants] = useState<SafeMerchantSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const availableDestinations = Array.from(
    new Set([...destinations, "JP", "GB", "FR", "SG", "US"])
  ) as CountryCode[];

  const country = getCountry(selectedCountry);

  useEffect(() => {
    let isMounted = true;
    const params = new URLSearchParams();
    if (selectedCountry) {
      params.set("countryCode", selectedCountry);
    }
    if (selectedCategory && selectedCategory !== "all") {
      params.set("category", selectedCategory);
    }

    fetch(`/api/merchants?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted) {
          setMerchants(data?.items ?? []);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setError("Unable to load merchants catalogue. Please check your connection.");
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedCountry, selectedCategory]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Explore Merchants"
        description="Discover supported merchants in your travel corridors. Explore without linking; bank connection required for checkout."
        aside={
          isPaymentEligible ? (
            <Badge tone="success" icon={<ShieldCheck aria-hidden className="size-3.5" />}>
              Payment Enabled ({state.account?.maskedAccountNumber})
            </Badge>
          ) : (
            <Badge tone="neutral" icon={<Lock aria-hidden className="size-3.5" />}>
              Explore Mode (Bank not linked)
            </Badge>
          )
        }
      />

      {/* Filter controls */}
      <div className="flex flex-col gap-3">
        <FilterPills
          label="Corridor / Country"
          options={availableDestinations.map((code) => ({
            id: code,
            label: getCountry(code)?.name ?? code,
          }))}
          value={selectedCountry}
          onChange={(val) => setSelectedCountry(val as CountryCode)}
        />

        <FilterPills
          label="Category"
          options={CATEGORY_OPTIONS}
          value={selectedCategory}
          onChange={(val) => setSelectedCategory(val)}
        />
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="flex min-h-60 flex-col items-center justify-center gap-3 rounded-card border border-line bg-surface p-8 text-center">
          <LoaderCircle aria-hidden className="size-7 animate-spin text-lavender" />
          <p className="text-sm font-medium text-ink-muted">Loading supported merchants...</p>
        </div>
      ) : null}

      {/* Error state */}
      {!isLoading && error ? (
        <div className="flex min-h-60 flex-col items-center justify-center gap-3 rounded-card border border-danger/30 bg-danger/5 p-8 text-center">
          <AlertCircle aria-hidden className="size-8 text-danger" />
          <p className="text-sm font-medium text-danger">{error}</p>
          <Button
            variant="secondary"
            onClick={() => {
              setIsLoading(true);
              setError(null);
              const params = new URLSearchParams();
              if (selectedCountry) params.set("countryCode", selectedCountry);
              if (selectedCategory && selectedCategory !== "all") params.set("category", selectedCategory);
              fetch(`/api/merchants?${params.toString()}`)
                .then((res) => (res.ok ? res.json() : null))
                .then((data) => {
                  setMerchants(data?.items ?? []);
                  setIsLoading(false);
                })
                .catch(() => {
                  setError("Unable to load merchants catalogue. Please check your connection.");
                  setIsLoading(false);
                });
            }}
            className="text-xs"
          >
            <RefreshCw aria-hidden className="size-3.5" />
            Retry
          </Button>
        </div>
      ) : null}

      {/* Empty state */}
      {!isLoading && !error && merchants.length === 0 ? (
        <div className="flex min-h-60 flex-col items-center justify-center gap-2 rounded-card border border-line bg-surface p-8 text-center">
          <Filter aria-hidden className="size-8 text-ink-subtle" />
          <p className="text-sm font-semibold text-ink">No merchants found</p>
          <p className="text-xs text-ink-muted">
            No active merchants found for {country?.name ?? selectedCountry} in this category.
          </p>
          {selectedCategory !== "all" ? (
            <Button
              variant="ghost"
              onClick={() => setSelectedCategory("all")}
              className="mt-2 text-xs text-lavender hover:underline"
            >
              Reset category filter
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Merchants grid */}
      {!isLoading && !error && merchants.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {merchants.map((merchant, idx) => (
            <Reveal key={merchant.id} order={idx}>
              <Card className="flex h-full flex-col justify-between gap-4 p-5">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="grid size-10 place-items-center rounded-control bg-primary-soft text-lavender">
                      <MerchantCategoryIcon
                        category={merchant.category as MerchantCategory}
                        className="size-5"
                      />
                    </span>
                    <Badge>{merchant.category.toUpperCase()}</Badge>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-ink">{merchant.name}</h3>
                    <p className="font-mono text-xs text-ink-muted">
                      {country?.name ?? merchant.countryCode} &middot; Currency:{" "}
                      {merchant.displayCurrency}
                    </p>
                  </div>
                  {merchant.description ? (
                    <p className="text-xs text-ink-muted line-clamp-2">
                      {merchant.description}
                    </p>
                  ) : null}
                  <div className="rounded-control bg-canvas p-2 text-[11px] text-ink-muted">
                    <span className="font-medium text-ink">Supported:</span> PayPal Sandbox
                    {merchant.isDemo ? " (Demo Merchant)" : ""}
                  </div>
                </div>

                <div className="pt-2">
                  <ButtonLink
                    href={`/pay?merchantId=${merchant.id}`}
                    variant={isPaymentEligible ? "primary" : "secondary"}
                    className="w-full text-xs font-semibold sm:text-sm"
                  >
                    <Store aria-hidden className="size-4 shrink-0" />
                    Pay Merchant
                    <ArrowRight aria-hidden className="size-4 shrink-0" />
                  </ButtonLink>
                </div>
              </Card>
            </Reveal>
          ))}
        </div>
      ) : null}

      {/* Explorer callout when bank not linked */}
      {!isPaymentEligible ? (
        <Reveal order={4}>
          <div className="flex flex-col items-center justify-between gap-3 rounded-card border border-line bg-surface p-4 text-center sm:flex-row sm:text-left">
            <div>
              <p className="text-sm font-semibold text-ink">Ready to test checkout?</p>
              <p className="text-xs text-ink-muted">
                Link a simulated bank account to enable PayPal Sandbox test payments.
              </p>
            </div>
            <Link
              href="/connect-bank"
              className="inline-flex min-h-10 items-center justify-center rounded-control bg-lavender px-4 text-xs font-semibold text-on-lavender hover:bg-lavender-hover"
            >
              Link bank account
            </Link>
          </div>
        </Reveal>
      ) : null}
    </div>
  );
}

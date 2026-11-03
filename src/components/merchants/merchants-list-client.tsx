"use client";

import { ArrowRight, Lock, ShieldCheck, Store } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { MerchantCategoryIcon } from "@/components/merchants/merchant-category-icon";
import { Reveal } from "@/components/motion/reveal";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FilterPills } from "@/components/ui/filter-pills";
import { PageHeader } from "@/components/ui/page-header";
import { useBankLinking } from "@/features/bank-linking/bank-linking-context";
import { getSampleMerchants } from "@/features/merchants/sample-merchants";
import { getCountry, type CountryCode } from "@/features/travel/countries";
import { SAMPLE_PREFERENCES, useTravellerPreferences } from "@/features/travel/traveller-preferences";

export function MerchantsListClient() {
  const { preferences } = useTravellerPreferences();
  const { destinations } = preferences ?? SAMPLE_PREFERENCES;
  const { isPaymentEligible, state } = useBankLinking();

  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(destinations[0] ?? "JP");
  const country = getCountry(selectedCountry);
  const merchants = getSampleMerchants(selectedCountry);

  const availableDestinations = Array.from(
    new Set([...destinations, "JP", "GB", "FR", "SG", "US"])
  ) as CountryCode[];

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

      <FilterPills
        label="Corridor / Country"
        options={availableDestinations.map((code) => ({
          id: code,
          label: getCountry(code)?.name ?? code,
        }))}
        value={selectedCountry}
        onChange={(val) => setSelectedCountry(val as CountryCode)}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {merchants.map((merchant, idx) => (
          <Reveal key={merchant.id} order={idx}>
            <Card className="flex h-full flex-col justify-between gap-4 p-5">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="grid size-10 place-items-center rounded-control bg-primary-soft text-lavender">
                    <MerchantCategoryIcon category={merchant.category} className="size-5" />
                  </span>
                  <Badge>{merchant.label}</Badge>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-ink">{merchant.name}</h3>
                  <p className="font-mono text-xs text-ink-muted">
                    {merchant.place} &middot; Currency: {country.currency}
                  </p>
                </div>
                <p className="text-xs text-ink-muted">
                  Accepts PayPal Sandbox checkout. Indicative live conversion calculated at payment review.
                </p>
              </div>

              <div className="pt-2">
                <ButtonLink
                  href="/pay"
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

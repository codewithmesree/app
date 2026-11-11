"use client";

import {
  ArrowRight,
  Lock,
  QrCode,
  ScanLine,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Reveal } from "@/components/motion/reveal";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useBankLinking } from "@/features/bank-linking/bank-linking-context";
import type { MerchantCatalogueItem } from "@/features/merchants/merchant-types";
import { COUNTRIES } from "@/features/travel/countries";
import { SAMPLE_PREFERENCES, useTravellerPreferences } from "@/features/travel/traveller-preferences";
import { getMerchantPaymentHref, isDemoQrIdentifier } from "@/lib/qr/demo-qr";

export function ScanPageClient() {
  const router = useRouter();
  const { isPaymentEligible, state } = useBankLinking();
  const { preferences } = useTravellerPreferences();
  const { destinations } = preferences ?? SAMPLE_PREFERENCES;
  const destination = destinations[0];
  const [catalogue, setCatalogue] = useState<{
    countryCode: string;
    status: "loading" | "ready" | "error";
    merchants: MerchantCatalogueItem[];
  }>({ countryCode: "", status: "loading", merchants: [] });
  const [selectedCode, setSelectedCode] = useState("");
  const [isResolving, setIsResolving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch(
      `/api/merchants?countryCode=${encodeURIComponent(destination)}&limit=50&demoQrOnly=true`,
      {
      signal: controller.signal,
      cache: "no-store",
      }
    )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Merchant catalogue is currently unavailable. Please try again.");
        }
        return (await response.json()) as { items?: MerchantCatalogueItem[] };
      })
      .then((data) => {
        const demoMerchants = (data.items ?? []).filter(
          (merchant) =>
            merchant.isDemo &&
            merchant.supportedMethods.includes("PAYPAL_SANDBOX") &&
            merchant.demoQrIdentifier &&
            isDemoQrIdentifier(merchant.demoQrIdentifier)
        );
        setSelectedCode(demoMerchants[0]?.demoQrIdentifier ?? "");
        setCatalogue({ countryCode: destination, status: "ready", merchants: demoMerchants });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setCatalogue({ countryCode: destination, status: "error", merchants: [] });
      });

    return () => controller.abort();
  }, [destination]);

  const isLoading =
    catalogue.countryCode !== destination || catalogue.status === "loading";
  const merchants =
    catalogue.countryCode === destination ? catalogue.merchants : [];
  const catalogueError =
    catalogue.countryCode === destination && catalogue.status === "error";
  const currentMerchant = merchants.find(
    (merchant) => merchant.demoQrIdentifier === selectedCode
  );

  async function handleContinueToPayment() {
    if (!selectedCode || !isDemoQrIdentifier(selectedCode)) {
      setErrorMessage("Select a supported GlobalPay demo QR code to continue.");
      return;
    }

    setIsResolving(true);
    setErrorMessage(null);
    try {
      const response = await fetch(
        `/api/merchants/demo-qr/${encodeURIComponent(selectedCode)}`,
        { cache: "no-store" }
      );
      if (!response.ok) {
        setErrorMessage(
          response.status === 404
            ? "This demo QR merchant is no longer available."
            : "We could not verify this demo QR. Please select another merchant and try again."
        );
        return;
      }

      const data = (await response.json()) as { merchant?: MerchantCatalogueItem };
      const merchant = data.merchant;
      if (
        !merchant ||
        merchant.isDemo !== true ||
        merchant.isActive !== true ||
        merchant.demoQrIdentifier !== selectedCode ||
        !merchant.supportedMethods.includes("PAYPAL_SANDBOX")
      ) {
        setErrorMessage("This demo QR merchant is not available for payment.");
        return;
      }

      router.push(getMerchantPaymentHref(merchant.id));
    } catch {
      setErrorMessage("We could not verify this demo QR. Please try again.");
    } finally {
      setIsResolving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-4">
      <Reveal>
        <div className="flex flex-col gap-1">
          <p className="label-mono text-ink-muted">Demo QR selection &middot; Explore &amp; Pay</p>
          <h1 className="text-2xl font-semibold text-ink sm:text-3xl">Select a Demo QR</h1>
          <p className="text-sm text-ink-muted">
            Camera scanning is not available. Choose a simulated demo QR to review its active merchant before payment.
          </p>
        </div>
      </Reveal>

      {!isPaymentEligible ? (
        <Reveal order={1}>
          <div className="flex items-center gap-3 rounded-card border border-warning/30 bg-warning/10 p-4 text-warning">
            <Lock aria-hidden className="size-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Bank linking required for payment</p>
              <p className="text-xs text-ink-muted">
                You can select a demo merchant now. Payment review will guide you through bank linking.
              </p>
            </div>
          </div>
        </Reveal>
      ) : (
        <Reveal order={1}>
          <div className="flex items-center gap-2 rounded-card border border-success/30 bg-success/10 p-3 text-xs text-success">
            <ShieldCheck aria-hidden className="size-4 shrink-0" />
            Bank linked ({state.account?.maskedAccountNumber}) &middot; PayPal Sandbox available
          </div>
        </Reveal>
      )}

      <Reveal order={2}>
        <Card className="flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <h2 className="label-mono text-ink-muted">Active demo merchants</h2>
            <Badge>Simulated QR</Badge>
          </div>

          {isLoading ? (
            <p className="text-sm text-ink-muted">Loading demo merchants...</p>
          ) : catalogueError ? (
            <Alert tone="danger" title="Merchant catalogue unavailable">
              Please refresh and try again.
            </Alert>
          ) : merchants.length === 0 ? (
            <p className="text-sm text-ink-muted">
              No supported demo merchants are available for{" "}
              {COUNTRIES.find((country) => country.code === destination)?.name ?? "this destination"}.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {merchants.map((merchant) => {
                const isSelected = merchant.demoQrIdentifier === selectedCode;
                return (
                  <button
                    key={merchant.id}
                    type="button"
                    onClick={() => setSelectedCode(merchant.demoQrIdentifier ?? "")}
                    className={`flex items-center gap-3 rounded-control border p-3 text-left transition-all ${
                      isSelected
                        ? "border-primary bg-primary-soft/50 ring-1 ring-primary"
                        : "border-line bg-canvas hover:border-ink-subtle"
                    }`}
                  >
                    <QrCode aria-hidden className="size-5 shrink-0 text-lavender" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{merchant.name}</p>
                      <p className="text-xs text-ink-muted">{merchant.category}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {currentMerchant ? (
            <div className="flex flex-col items-center justify-center rounded-control border border-line bg-surface-raised p-6 text-center">
              <div className="grid size-36 place-items-center rounded-2xl border-2 border-dashed border-line bg-canvas p-4 text-ink-muted">
                <ScanLine aria-hidden className="size-16 text-lavender" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-ink">{currentMerchant.name}</h3>
              <p className="text-xs text-ink-muted">
                {COUNTRIES.find((country) => country.code === currentMerchant.countryCode)?.name ??
                  "Demo merchant"}{" "}
                &middot; {currentMerchant.displayCurrency}
              </p>
              <p className="mt-2 font-mono text-xs text-ink-muted">
                {currentMerchant.demoQrIdentifier}
              </p>
            </div>
          ) : null}
        </Card>
      </Reveal>

      <Reveal order={3}>
        <div className="flex flex-col gap-3">
          {errorMessage ? (
            <Alert tone="danger" title="Unable to continue">
              {errorMessage}
            </Alert>
          ) : null}

          <Button
            variant="accent"
            onClick={handleContinueToPayment}
            disabled={isLoading || catalogueError || isResolving || !currentMerchant}
            className="min-h-14 text-base"
          >
            {isResolving ? "Verifying demo merchant..." : "Continue to payment review"}
            <ArrowRight aria-hidden className="size-5 shrink-0" />
          </Button>

          <Link
            href="/dashboard"
            className="inline-flex min-h-11 items-center justify-center rounded-control px-4 text-sm font-medium text-ink-muted hover:text-ink"
          >
            Cancel and return to Dashboard
          </Link>
        </div>
      </Reveal>
    </div>
  );
}

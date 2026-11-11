"use client";

import {
  ArrowRight,
  Landmark,
  Store,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Reveal } from "@/components/motion/reveal";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useBankLinking } from "@/features/bank-linking/bank-linking-context";
import type { MerchantCatalogueItem } from "@/features/merchants/merchant-types";
import { COUNTRIES, getCountry } from "@/features/travel/countries";
import { SAMPLE_PREFERENCES, useTravellerPreferences } from "@/features/travel/traveller-preferences";
import { formatDecimal } from "@/lib/format-money";

type PaymentReviewScreenProps = {
  merchantId?: string | null;
};

type QuoteState = {
  key: string;
  status: "loading" | "ready" | "unavailable";
  convertedAmount?: string;
  quoteId?: string;
};

export function PaymentReviewScreen({ merchantId: requestedMerchantId }: PaymentReviewScreenProps) {
  const { state } = useBankLinking();
  const { preferences } = useTravellerPreferences();
  const { homeCountry, destinations, displayCurrency } = preferences ?? SAMPLE_PREFERENCES;
  const destination = destinations[0];
  const merchantLoadKey = `${destination}:${requestedMerchantId ?? ""}`;
  const [merchantLoad, setMerchantLoad] = useState<{
    key: string;
    status: "loading" | "ready" | "error";
    merchants: MerchantCatalogueItem[];
  }>({ key: "", status: "loading", merchants: [] });
  const merchants =
    merchantLoad.key === merchantLoadKey ? merchantLoad.merchants : [];
  const isMerchantLoading =
    merchantLoad.key !== merchantLoadKey || merchantLoad.status === "loading";
  const merchantLoadError =
    merchantLoad.key === merchantLoadKey && merchantLoad.status === "error";
  const [selectedMerchantId, setSelectedMerchantId] = useState("");
  const [quoteState, setQuoteState] = useState<QuoteState>({ key: "", status: "loading" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [approvalUrl, setApprovalUrl] = useState<string | null>(null);
  const [pendingPayment, setPendingPayment] = useState<{
    transactionId: string;
    idempotencyKey: string;
  } | null>(null);

  const linkedAccount = state.account;
  const selectedMerchant =
    merchants.find((merchant) => merchant.id === selectedMerchantId) ?? null;
  const amount = selectedMerchant?.demoAmount ?? "";
  const merchantCurrency = selectedMerchant?.displayCurrency ?? "";
  const quoteKey = `${selectedMerchantId}:${amount}:${merchantCurrency}:${displayCurrency}`;
  const currentQuote = quoteState.key === quoteKey ? quoteState : null;
  const isQuoteLoading = Boolean(
    selectedMerchant && (!currentQuote || currentQuote.status === "loading")
  );
  const convertedAmount = currentQuote?.status === "ready" ? currentQuote.convertedAmount : null;
  const quoteId = currentQuote?.status === "ready" ? currentQuote.quoteId : null;
  const merchantCountryName =
    COUNTRIES.find((country) => country.code === selectedMerchant?.countryCode)?.name ??
    "the selected merchant's location";

  useEffect(() => {
    const controller = new AbortController();

    async function loadMerchants() {
      try {
        const listUrl = `/api/merchants?countryCode=${encodeURIComponent(destination)}&limit=50`;
        const listResponse = await fetch(listUrl, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!listResponse.ok) {
          throw new Error("Merchant catalogue is currently unavailable.");
        }

        const listData = (await listResponse.json()) as { items?: MerchantCatalogueItem[] };
        const availableMerchants = (listData.items ?? []).filter(
          (merchant) =>
            merchant.isDemo &&
            typeof merchant.demoAmount === "string" &&
            merchant.supportedMethods.includes("PAYPAL_SANDBOX")
        );

        let requestedMerchant: MerchantCatalogueItem | null = null;
        if (requestedMerchantId) {
          if (requestedMerchantId.length > 140 || requestedMerchantId.trim() !== requestedMerchantId) {
            throw new Error("The selected merchant is not available.");
          }
          const detailResponse = await fetch(
            `/api/merchants/${encodeURIComponent(requestedMerchantId)}`,
            { signal: controller.signal, cache: "no-store" }
          );
          if (!detailResponse.ok) {
            throw new Error("The selected merchant is no longer available.");
          }
          const detailData = (await detailResponse.json()) as {
            merchant?: MerchantCatalogueItem;
          };
          requestedMerchant = detailData.merchant ?? null;
          if (
            !requestedMerchant ||
            requestedMerchant.isActive !== true ||
            requestedMerchant.isDemo !== true ||
            typeof requestedMerchant.demoAmount !== "string" ||
            !requestedMerchant.supportedMethods.includes("PAYPAL_SANDBOX")
          ) {
            throw new Error("The selected merchant is not available for payment.");
          }
        }

        if (controller.signal.aborted) return;
        const options = requestedMerchant &&
            !availableMerchants.some((merchant) => merchant.id === requestedMerchant.id)
          ? [requestedMerchant, ...availableMerchants]
          : availableMerchants;
        const initialMerchant = requestedMerchant ?? options[0] ?? null;
        setMerchantLoad({ key: merchantLoadKey, status: "ready", merchants: options });
        setSelectedMerchantId(initialMerchant?.id ?? "");
      } catch {
        if (controller.signal.aborted) return;
        setMerchantLoad({ key: merchantLoadKey, status: "error", merchants: [] });
      }
    }

    void loadMerchants();
    return () => controller.abort();
  }, [destination, merchantLoadKey, requestedMerchantId]);

  useEffect(() => {
    if (!selectedMerchantId || !amount || !merchantCurrency) return;

    const controller = new AbortController();
    void fetch("/api/currency/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        baseAmount: amount,
        baseCurrency: merchantCurrency,
        quoteCurrency: displayCurrency,
      }),
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload?.quote?.id || !payload?.quote?.convertedAmount) {
          throw new Error("The indicative estimate could not be loaded or saved.");
        }
        setQuoteState({
          key: quoteKey,
          status: "ready",
          convertedAmount: payload.quote.convertedAmount,
          quoteId: payload.quote.id,
        });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setQuoteState({ key: quoteKey, status: "unavailable" });
      });

    return () => controller.abort();
  }, [amount, merchantCurrency, displayCurrency, quoteKey, selectedMerchantId]);

  const handleStartPayment = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      let payment = pendingPayment;
      if (!payment) {
        const txnRes = await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            merchantId: selectedMerchantId,
            amount,
            currency: merchantCurrency,
            quoteId: quoteId || undefined,
          }),
        });

        const txnData = await txnRes.json();
        if (!txnRes.ok || typeof txnData?.transaction?.id !== "string") {
          throw new Error(
            txnData?.error?.message || "Failed to initiate transaction."
          );
        }

        payment = {
          transactionId: txnData.transaction.id,
          idempotencyKey: `create_${txnData.transaction.id}_${Date.now()}`,
        };
        setPendingPayment(payment);
      }

      const payRes = await fetch("/api/payments/paypal/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: payment.transactionId,
          idempotencyKey: payment.idempotencyKey,
        }),
      });

      const payData = await payRes.json();
      if (!payRes.ok) {
        throw new Error(
          payData?.error?.message || "Failed to create PayPal payment order."
        );
      }

      if (payData.approvalUrl) {
        setApprovalUrl(payData.approvalUrl);
        // Direct window navigation to PayPal Sandbox approval URL
        window.location.href = payData.approvalUrl;
      } else {
        throw new Error("No approval URL received from PayPal.");
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "An unexpected error occurred.");
      setIsSubmitting(false);
    }
  };

  if (approvalUrl) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 py-12 text-center">
        <Reveal>
          <div className="flex flex-col items-center">
            <span className="grid size-14 place-items-center rounded-full bg-lavender/20 text-lavender animate-pulse">
              <ExternalLink aria-hidden className="size-8" />
            </span>
            <Badge tone="info" className="mt-4">
              Redirecting to PayPal Sandbox
            </Badge>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Proceed to PayPal Sandbox
            </h1>
            <p className="mt-2 text-sm text-ink-muted">
              Redirecting you to complete authorization. If your browser does not redirect automatically, please click below.
            </p>
            <a
              href={approvalUrl}
              className="mt-6 inline-flex min-h-12 items-center justify-center rounded-control bg-primary px-6 font-medium text-white hover:bg-primary-hover"
            >
              Continue to PayPal
            </a>
          </div>
        </Reveal>
      </div>
    );
  }

  if (isMerchantLoading) {
    return (
      <div className="mx-auto w-full max-w-2xl py-12 text-center text-sm text-ink-muted">
        Loading active merchant details...
      </div>
    );
  }

  if (merchantLoadError || !selectedMerchant) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 py-8">
        <Alert tone="danger" title="Merchant unavailable">
          {merchantLoadError
            ? "We could not load an active merchant for payment. Return to the merchant catalogue and try again."
            : "No active merchant is available for payment."}
        </Alert>
        <Link
          href="/merchants"
          className="inline-flex min-h-11 items-center justify-center rounded-control border border-line px-4 text-sm font-medium text-ink hover:bg-surface-raised"
        >
          Return to merchant catalogue
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-4">
      {/* Header */}
      <Reveal>
        <div className="flex flex-col gap-1">
          <p className="label-mono text-ink-muted">Payment review &middot; PayPal Sandbox</p>
          <h1 className="text-2xl font-semibold text-ink sm:text-3xl">Pay Merchant</h1>
          <p className="text-sm text-ink-muted">
            Review {selectedMerchant.name} before continuing to PayPal Sandbox.
          </p>
        </div>
      </Reveal>

      {/* Linked Bank Account Banner */}
      <Reveal order={1}>
        <div className="flex items-center justify-between rounded-card border border-success/30 bg-success/10 p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-control bg-success/20 text-success">
              <Landmark aria-hidden className="size-4" />
            </span>
            <div>
              <p className="text-xs font-semibold text-success">Linked Payment Source</p>
              <p className="font-mono text-sm text-ink">
                {linkedAccount?.institutionName} ({linkedAccount?.maskedAccountNumber})
              </p>
            </div>
          </div>
          <Badge tone="success">Mandate Active</Badge>
        </div>
      </Reveal>

      {/* Merchant & Amount Selection */}
      <Reveal order={2}>
        <Card className="flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <h2 className="label-mono text-ink-muted">Choose active demo merchant</h2>
            <Badge>Demo Corridor</Badge>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {merchants.map((merchant) => {
              const isSelected = merchant.id === selectedMerchantId;
              return (
                <button
                  key={merchant.id}
                  type="button"
                  disabled={isSubmitting || pendingPayment !== null}
                  onClick={() => setSelectedMerchantId(merchant.id)}
                  className={`flex flex-col rounded-control border p-3 text-left transition-all ${
                    isSelected
                      ? "border-primary bg-primary-soft/50 ring-1 ring-primary"
                      : "border-line bg-canvas hover:border-ink-subtle"
                  }`}
                >
                  <Store aria-hidden className="size-4 text-ink-muted" />
                  <p className="mt-1 text-sm font-semibold text-ink">{merchant.name}</p>
                  <p className="text-xs text-ink-muted">
                    {merchant.displayCurrency} &middot; {merchant.category}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="rounded-control border border-line bg-surface-raised p-4">
            <p className="mb-3 text-sm font-semibold text-ink">{selectedMerchant.name}</p>
            <div className="flex items-baseline justify-between text-xs text-ink-muted">
              <span>Demo amount</span>
              <span>Indicative home estimate</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-mono text-2xl font-semibold text-ink">
                {amount} <span className="text-base text-ink-muted">{merchantCurrency}</span>
              </span>
              <span className="font-mono text-lg font-medium text-lavender">
                &asymp; {isQuoteLoading ? "..." : convertedAmount ? formatDecimal(convertedAmount) : "---"}{" "}
                {displayCurrency}
              </span>
            </div>
            <p className="mt-2 text-xs text-ink-muted">
              Indicative FX estimate only; the checkout amount may differ &middot; merchant location: {merchantCountryName} &middot; home country:{" "}
              {getCountry(homeCountry).name}
            </p>
          </div>
          {currentQuote?.status === "unavailable" ? (
            <Alert tone="info" title="Indicative estimate unavailable">
              The sample payment amount remains in the merchant&rsquo;s currency. No converted estimate will be attached
              to the receipt.
            </Alert>
          ) : null}
        </Card>
      </Reveal>

      {/* Sandbox Notice & Action */}
      <Reveal order={3}>
        <div className="flex flex-col gap-3">
          {errorMessage ? (
            <Alert tone="danger" title="Payment Error">
              {errorMessage}
            </Alert>
          ) : null}
          {pendingPayment ? (
            <Alert tone="warning" title="Existing payment attempt">
              This payment attempt is being retried with the same server idempotency key. Do not start a second payment
              until its status is confirmed.
            </Alert>
          ) : null}

          <Alert tone="warning" title="Test Environment">
            GlobalPay is operating in PayPal Sandbox mode. Clicking proceed creates a Sandbox order and redirects to PayPal for test approval.
          </Alert>

          <Button
            variant="accent"
            onClick={handleStartPayment}
            disabled={isSubmitting || isQuoteLoading || !selectedMerchantId}
            className="min-h-14 text-base"
          >
            {isSubmitting
              ? "Initiating Sandbox Order..."
              : pendingPayment
                ? "Retry unresolved PayPal order"
                : "Authorize Sandbox Payment"}
            <ArrowRight aria-hidden className="size-5 shrink-0" />
          </Button>

          <Link
            href="/dashboard"
            className="inline-flex min-h-11 items-center justify-center rounded-control px-4 text-sm font-medium text-ink-muted hover:text-ink"
          >
            Cancel and return to dashboard
          </Link>
        </div>
      </Reveal>
    </div>
  );
}

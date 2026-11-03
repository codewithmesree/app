import type { RateStatus } from "@/features/currency/currency-types";
import type { TransactionsState, TransactionSummary } from "@/features/payment/payment-types";

/**
 * Local fixtures for the prototype dashboard (designs.md section 14, step 2).
 * Nothing here is real: merchants are fictional and no payment took place.
 * Replace with API responses once the endpoints exist.
 */
export type DashboardData = {
  rateStatus: RateStatus;
  transactions: TransactionsState;
};

export const PREVIEW_STATES = [
  { id: "sample", label: "Sample activity" },
  { id: "first-visit", label: "First visit" },
  { id: "loading", label: "Loading" },
  { id: "quote-unavailable", label: "Rate unavailable" },
] as const;

export type PreviewState = (typeof PREVIEW_STATES)[number]["id"];

const SAMPLE_TRANSACTIONS: TransactionSummary[] = [
  {
    id: "txn_sample_04",
    merchant: { id: "merch_sample_lantern", name: "Lantern Lane Café", category: "dining" },
    amount: "1840",
    currency: "JPY",
    status: "AWAITING_APPROVAL",
    createdAt: "2026-10-31T09:42:00.000Z",
    updatedAt: "2026-10-31T09:42:00.000Z",
  },
  {
    id: "txn_sample_03",
    merchant: { id: "merch_sample_marigold", name: "Marigold Street Books", category: "retail" },
    amount: "42.80",
    currency: "SGD",
    status: "COMPLETED",
    createdAt: "2026-10-30T16:18:00.000Z",
    updatedAt: "2026-10-30T16:19:00.000Z",
  },
  {
    id: "txn_sample_02",
    merchant: { id: "merch_sample_harbour", name: "Harbour Line Transit", category: "transit" },
    amount: "25.00",
    currency: "GBP",
    status: "STATUS_UNKNOWN",
    createdAt: "2026-10-30T08:05:00.000Z",
    updatedAt: "2026-10-30T08:06:00.000Z",
  },
  {
    id: "txn_sample_01",
    merchant: { id: "merch_sample_cedar", name: "Cedar Court Hotel", category: "hotel" },
    amount: "23800",
    currency: "JPY",
    status: "CANCELLED",
    createdAt: "2026-10-29T19:30:00.000Z",
    updatedAt: "2026-10-29T19:31:00.000Z",
  },
];

export function parsePreviewState(value: string | string[] | undefined): PreviewState {
  return PREVIEW_STATES.find((state) => state.id === value)?.id ?? "sample";
}

export function getDashboardData(preview: PreviewState): DashboardData {
  switch (preview) {
    case "first-visit":
      return { rateStatus: "ready", transactions: { status: "ready", items: [] } };
    case "loading":
      return { rateStatus: "loading", transactions: { status: "loading" } };
    case "quote-unavailable":
      return { rateStatus: "unavailable", transactions: { status: "ready", items: SAMPLE_TRANSACTIONS } };
    case "sample":
      return { rateStatus: "ready", transactions: { status: "ready", items: SAMPLE_TRANSACTIONS } };
  }
}

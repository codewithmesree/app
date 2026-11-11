import type { MerchantCategory } from "@/features/merchants/merchant-types";

/** Server-controlled transaction states (api-contract.md section 3.1). */
export type TransactionStatus =
  | "CREATED"
  | "AWAITING_APPROVAL"
  | "CAPTURE_PENDING"
  | "COMPLETED"
  | "CANCELLED"
  | "FAILED"
  | "STATUS_UNKNOWN";

/** List item shape from GET /api/transactions (api-contract.md section 7.2). */
export type TransactionSummary = {
  id: string;
  merchant: {
    id: string;
    name: string;
    /** Not in the contract yet; add it there before the real endpoint returns it. */
    category?: MerchantCategory;
  };
  amount: string;
  currency: string;
  status: TransactionStatus;
  createdAt: string;
  updatedAt: string;
};

export type TransactionDetail = {
  id: string;
  merchant: {
    name: string;
    countryCode: string | null;
  };
  amount: string;
  currency: string;
  status: TransactionStatus;
  indicativeEstimate?: {
    homeCurrency: string;
    estimatedHomeAmount: string;
    rate: string;
    asOf?: string;
    baseCurrency?: string;
    quoteCurrency?: string;
  };
  createdAt: string;
  completedAt?: string;
  providerCaptureId?: string;
};

export type TransactionsState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; items: TransactionSummary[] };

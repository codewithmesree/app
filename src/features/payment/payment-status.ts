import type { TransactionStatus } from "./payment-types";

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

/** Stable wording and tone per status (designs.md section 4.6). */
export const PAYMENT_STATUS: Record<TransactionStatus, { label: string; tone: StatusTone }> = {
  CREATED: { label: "Payment prepared", tone: "neutral" },
  AWAITING_APPROVAL: { label: "Waiting for PayPal approval", tone: "info" },
  CAPTURE_PENDING: { label: "Verifying test payment", tone: "info" },
  COMPLETED: { label: "Sandbox payment completed", tone: "success" },
  CANCELLED: { label: "Approval not completed", tone: "neutral" },
  FAILED: { label: "Payment could not be completed", tone: "danger" },
  STATUS_UNKNOWN: { label: "Status not confirmed yet", tone: "warning" },
};

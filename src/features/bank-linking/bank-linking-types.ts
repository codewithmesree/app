/**
 * Bank linking status and state definitions.
 *
 * GlobalPay requires bank linking for payment execution (PayPal Sandbox in MVP),
 * but allows explore-only access without linking.
 *
 * NOTE: For this frontend milestone, all banking connections are simulated mock
 * states. No actual open-banking integration or credential transmission takes place.
 */

export type BankLinkingStatus =
  | "not_linked"
  | "linking_in_progress"
  | "linked"
  | "linking_failed"
  | "connection_expired"
  | "reconnection_required";

export type LinkedBankAccount = {
  /** Display name of the banking institution (mocked for demo). */
  institutionName: string;
  /** Safely masked account identifier, e.g. "•••• 4821". Never raw full account numbers. */
  maskedAccountNumber: string;
  /** Account category, e.g. "Checking" or "Travel Account". */
  accountType: string;
  /** ISO timestamp of when the mock connection was established. */
  linkedAt: string;
  /** ISO timestamp if the connection has a scheduled expiration. */
  expiresAt?: string;
  /** Human-readable holder label for display purposes only. */
  holderLabel?: string;
};

export type BankLinkingState = {
  status: BankLinkingStatus;
  account: LinkedBankAccount | null;
  /** Safe, non-sensitive failure reason or user-facing notice. */
  notice: string | null;
  /** Explicitly marks this state as a frontend simulation, never a verified bank rail. */
  readonly isSimulated: true;
};

/**
 * Payment eligibility check: only "linked" users can access or initiate payment flows.
 * Explore-only users (not_linked, linking_in_progress, linking_failed, connection_expired,
 * reconnection_required) must be gated from payment creation.
 */
export function isPaymentEligible(status: BankLinkingStatus): boolean {
  return status === "linked";
}

export type BankStatusTone = "neutral" | "info" | "success" | "warning" | "danger";

export type BankStatusMeta = {
  label: string;
  tone: BankStatusTone;
  shortDescription: string;
  longDescription: string;
  primaryActionLabel?: string;
  secondaryActionLabel?: string;
};

export const BANK_STATUS_CONFIG: Record<BankLinkingStatus, BankStatusMeta> = {
  not_linked: {
    label: "Bank account not linked",
    tone: "neutral",
    shortDescription: "Explore mode active. Link a bank account to enable test payments.",
    longDescription:
      "GlobalPay lets you explore currency rates, travel advice and sample merchants freely. To pay merchants, connect a bank account via our secure simulation.",
    primaryActionLabel: "Link bank account",
    secondaryActionLabel: "Explore demo",
  },
  linking_in_progress: {
    label: "Linking in progress",
    tone: "info",
    shortDescription: "Awaiting open-banking token exchange...",
    longDescription:
      "Connecting to the banking provider sandbox. You will be redirected once your test connection is confirmed.",
    primaryActionLabel: "Continue linking",
    secondaryActionLabel: "Cancel",
  },
  linked: {
    label: "Bank account connected",
    tone: "success",
    shortDescription: "Payment-enabled for PayPal Sandbox demo payments.",
    longDescription:
      "Your bank account is linked for demonstration payments. Transactions will be processed through PayPal Sandbox with no real money moving.",
    primaryActionLabel: "Manage in Settings",
    secondaryActionLabel: "Pay Merchant",
  },
  linking_failed: {
    label: "Linking failed",
    tone: "danger",
    shortDescription: "The bank connection could not be established.",
    longDescription:
      "The simulated banking provider encountered a verification error. No real accounts or credentials were affected.",
    primaryActionLabel: "Retry linking",
    secondaryActionLabel: "Back to dashboard",
  },
  connection_expired: {
    label: "Connection expired",
    tone: "warning",
    shortDescription: "Bank session expired. Reconnect to resume payments.",
    longDescription:
      "For your security, banking provider authorizations expire periodically. Please re-authenticate your connection before making payments.",
    primaryActionLabel: "Reconnect account",
    secondaryActionLabel: "Maybe later",
  },
  reconnection_required: {
    label: "Reconnection required",
    tone: "warning",
    shortDescription: "Security update requires re-linking your account.",
    longDescription:
      "The open-banking provider requires account re-consent to continue authorizing demo payments.",
    primaryActionLabel: "Reconnect now",
    secondaryActionLabel: "Return to dashboard",
  },
};


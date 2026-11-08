// =============================================================================
// GlobalPay — Payment Eligibility Service
// =============================================================================
// PRD §17.1, payment-flow.md §17.2, threat-model.md T5:
// Server-only evaluator for payment eligibility.
//
// RULES:
// - LINKED: eligible (subject to other payment-level requirements).
// - NOT_LINKED, LINKING_IN_PROGRESS, LINKING_FAILED, CONNECTION_EXPIRED,
//   RECONNECTION_REQUIRED: ineligible.
// =============================================================================

import "server-only";
import { BankConnectionStatus } from "@prisma/client";
import { db } from "../db";
import {
  toClientBankStatus,
  type ClientBankStatus,
} from "../bank-linking/bank-service";

export type EligibilityReasonCode =
  | "ELIGIBLE"
  | "BANK_LINKING_REQUIRED"
  | "LINKING_IN_PROGRESS"
  | "LINKING_FAILED"
  | "CONNECTION_EXPIRED"
  | "RECONNECTION_REQUIRED";

export interface PaymentEligibilityResult {
  eligible: boolean;
  reasonCode: EligibilityReasonCode;
  explanation: string;
  bankStatus: ClientBankStatus;
}

/**
 * Evaluates whether an authenticated session is eligible to initiate/execute payments.
 *
 * @param sessionId - Authenticated DemoSession ID.
 */
export async function evaluatePaymentEligibility(
  sessionId: string
): Promise<PaymentEligibilityResult> {
  const conn = await db.bankConnection.findUnique({
    where: { sessionId },
  });

  const status = conn?.status ?? BankConnectionStatus.NOT_LINKED;
  const clientStatus = toClientBankStatus(status);

  switch (status) {
    case BankConnectionStatus.LINKED:
      return {
        eligible: true,
        reasonCode: "ELIGIBLE",
        explanation:
          "Payment access enabled. Bank connection verified for PayPal Sandbox testing.",
        bankStatus: clientStatus,
      };

    case BankConnectionStatus.LINKING_IN_PROGRESS:
      return {
        eligible: false,
        reasonCode: "LINKING_IN_PROGRESS",
        explanation:
          "Bank linking is in progress. Please complete authorization before initiating payment.",
        bankStatus: clientStatus,
      };

    case BankConnectionStatus.LINKING_FAILED:
      return {
        eligible: false,
        reasonCode: "LINKING_FAILED",
        explanation:
          "Bank connection failed. Please retry connecting your bank account to enable payments.",
        bankStatus: clientStatus,
      };

    case BankConnectionStatus.CONNECTION_EXPIRED:
      return {
        eligible: false,
        reasonCode: "CONNECTION_EXPIRED",
        explanation:
          "Bank connection has expired. Please reconnect your account to authorize payments.",
        bankStatus: clientStatus,
      };

    case BankConnectionStatus.RECONNECTION_REQUIRED:
      return {
        eligible: false,
        reasonCode: "RECONNECTION_REQUIRED",
        explanation:
          "Security re-consent required by banking provider before payments can proceed.",
        bankStatus: clientStatus,
      };

    case BankConnectionStatus.NOT_LINKED:
    default:
      return {
        eligible: false,
        reasonCode: "BANK_LINKING_REQUIRED",
        explanation:
          "A linked bank account is required before making payments. Please connect a bank account in demo mode.",
        bankStatus: clientStatus,
      };
  }
}


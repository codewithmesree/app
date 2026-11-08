// =============================================================================
// GlobalPay — Simulated Bank Linking Service
// =============================================================================
// PRD §17.1, database-schema.md §4.3, threat-model.md:
// Server-only data access & state machine for simulated bank connections.
//
// INVARIANTS:
// 1. isSimulated is always true.
// 2. Real credentials, PINs, OTPs, or OAuth tokens are NEVER accepted or stored.
// 3. States strictly follow permitted transitions.
// =============================================================================

import "server-only";
import { BankConnectionStatus, type BankConnection } from "@prisma/client";
import { db } from "../db";
import { ApiError } from "../errors/api-error";
import { logger } from "../logging/logger";
import { getDemoInstitution } from "./bank-catalog";

export interface SafeLinkedAccount {
  institutionName: string;
  maskedAccountNumber: string;
  accountType: string;
  linkedAt: string;
  expiresAt: string | null;
}

export type ClientBankStatus =
  | "not_linked"
  | "linking_in_progress"
  | "linked"
  | "linking_failed"
  | "connection_expired"
  | "reconnection_required";

export interface SafeBankConnection {
  status: ClientBankStatus;
  account: SafeLinkedAccount | null;
  notice: string | null;
  isSimulated: true;
}

/**
 * Maps Prisma BankConnectionStatus enum to client snake_case status.
 */
export function toClientBankStatus(status: BankConnectionStatus): ClientBankStatus {
  switch (status) {
    case BankConnectionStatus.NOT_LINKED:
      return "not_linked";
    case BankConnectionStatus.LINKING_IN_PROGRESS:
      return "linking_in_progress";
    case BankConnectionStatus.LINKED:
      return "linked";
    case BankConnectionStatus.LINKING_FAILED:
      return "linking_failed";
    case BankConnectionStatus.CONNECTION_EXPIRED:
      return "connection_expired";
    case BankConnectionStatus.RECONNECTION_REQUIRED:
      return "reconnection_required";
    default:
      return "not_linked";
  }
}

/**
 * Formats a BankConnection database record into a safe, public client response.
 */
export function formatSafeBankConnection(
  conn: BankConnection | null,
  noticeOverride?: string | null
): SafeBankConnection {
  if (!conn || conn.status === BankConnectionStatus.NOT_LINKED) {
    return {
      status: "not_linked",
      account: null,
      notice: noticeOverride ?? null,
      isSimulated: true,
    };
  }

  const clientStatus = toClientBankStatus(conn.status);

  let account: SafeLinkedAccount | null = null;
  if (
    conn.status === BankConnectionStatus.LINKED ||
    conn.status === BankConnectionStatus.CONNECTION_EXPIRED ||
    conn.status === BankConnectionStatus.RECONNECTION_REQUIRED
  ) {
    if (conn.institutionName && conn.maskedAccountNumber) {
      account = {
        institutionName: conn.institutionName,
        maskedAccountNumber: conn.maskedAccountNumber,
        accountType: conn.accountType ?? "Checking",
        linkedAt: (conn.authorizedAt ?? conn.updatedAt).toISOString(),
        expiresAt: conn.expiresAt ? conn.expiresAt.toISOString() : null,
      };
    }
  }

  let notice: string | null = noticeOverride ?? null;
  if (!notice) {
    if (conn.status === BankConnectionStatus.LINKING_FAILED) {
      notice = "The simulated banking provider encountered a verification error.";
    } else if (conn.status === BankConnectionStatus.CONNECTION_EXPIRED) {
      notice = "Simulated bank authorization token has expired.";
    } else if (conn.status === BankConnectionStatus.RECONNECTION_REQUIRED) {
      notice = "Security update requires re-linking your account.";
    }
  }

  return {
    status: clientStatus,
    account,
    notice,
    isSimulated: true,
  };
}

/**
 * Retrieves the current session's bank connection.
 */
export async function getBankConnection(
  sessionId: string
): Promise<SafeBankConnection> {
  const conn = await db.bankConnection.findUnique({
    where: { sessionId },
  });

  return formatSafeBankConnection(conn);
}

/**
 * Initiates a simulated bank linking handshake.
 * Transitions state to LINKING_IN_PROGRESS.
 */
export async function initiateBankLink(
  sessionId: string,
  institutionId: string
): Promise<SafeBankConnection> {
  const institution = getDemoInstitution(institutionId);

  const conn = await db.bankConnection.upsert({
    where: { sessionId },
    create: {
      sessionId,
      status: BankConnectionStatus.LINKING_IN_PROGRESS,
      institutionName: institution.name,
      maskedAccountNumber: institution.maskedNumber,
      accountType: institution.accountType,
      isSimulated: true,
      providerMandateId: `sim_mandate_${Date.now()}`,
    },
    update: {
      status: BankConnectionStatus.LINKING_IN_PROGRESS,
      institutionName: institution.name,
      maskedAccountNumber: institution.maskedNumber,
      accountType: institution.accountType,
      isSimulated: true,
      providerMandateId: `sim_mandate_${Date.now()}`,
      authorizedAt: null,
    },
  });

  logger.info("Initiated simulated bank linking", {
    context: { sessionId, institutionId: institution.id },
  });

  return formatSafeBankConnection(
    conn,
    "Initiating simulated Open Banking handshake..."
  );
}

/**
 * Completes or fails the simulated bank linking.
 * Strict state transition: caller must currently be in LINKING_IN_PROGRESS.
 */
export async function completeBankLink(
  sessionId: string,
  institutionId: string,
  simulateFailure = false,
  failureReason?: string
): Promise<SafeBankConnection> {
  const existing = await db.bankConnection.findUnique({
    where: { sessionId },
  });

  // Strict state machine validation
  if (!existing || existing.status !== BankConnectionStatus.LINKING_IN_PROGRESS) {
    throw ApiError.conflict(
      "TRANSACTION_STATE_CONFLICT",
      "Cannot complete bank linking without an active linking session in progress."
    );
  }

  const institution = getDemoInstitution(institutionId);

  if (simulateFailure) {
    const updated = await db.bankConnection.update({
      where: { sessionId },
      data: {
        status: BankConnectionStatus.LINKING_FAILED,
        isSimulated: true,
      },
    });

    const errorMsg =
      failureReason ??
      "Simulated bank verification timeout. No funds or credentials were transmitted.";

    logger.warn("Simulated bank linking failed", {
      context: { sessionId, reason: errorMsg },
    });

    return formatSafeBankConnection(updated, errorMsg);
  }

  // Simulated success
  const now = new Date();
  const updated = await db.bankConnection.update({
    where: { sessionId },
    data: {
      status: BankConnectionStatus.LINKED,
      institutionName: institution.name,
      maskedAccountNumber: institution.maskedNumber,
      accountType: institution.accountType,
      isSimulated: true,
      authorizedAt: now,
    },
  });

  logger.info("Simulated bank linking successfully completed", {
    context: {
      sessionId,
      institution: institution.name,
      maskedAccount: institution.maskedNumber,
    },
  });

  return formatSafeBankConnection(updated);
}

/**
 * Simulates transitional bank status (e.g. CONNECTION_EXPIRED or RECONNECTION_REQUIRED).
 * Only permitted when existing connection is in a linked state.
 */
export async function simulateStatus(
  sessionId: string,
  targetStatus: "connection_expired" | "reconnection_required"
): Promise<SafeBankConnection> {
  const existing = await db.bankConnection.findUnique({
    where: { sessionId },
  });

  if (!existing || existing.status === BankConnectionStatus.NOT_LINKED) {
    throw ApiError.conflict(
      "TRANSACTION_STATE_CONFLICT",
      "Cannot transition unlinked account to expired/reconnection state."
    );
  }

  const dbStatus =
    targetStatus === "connection_expired"
      ? BankConnectionStatus.CONNECTION_EXPIRED
      : BankConnectionStatus.RECONNECTION_REQUIRED;

  const updated = await db.bankConnection.update({
    where: { sessionId },
    data: {
      status: dbStatus,
      isSimulated: true,
    },
  });

  logger.info("Simulated bank status change", {
    context: { sessionId, targetStatus },
  });

  return formatSafeBankConnection(updated);
}

/**
 * Disconnects the current bank connection and reverts to NOT_LINKED.
 */
export async function disconnectBank(sessionId: string): Promise<SafeBankConnection> {
  const existing = await db.bankConnection.findUnique({
    where: { sessionId },
  });

  if (existing) {
    await db.bankConnection.update({
      where: { sessionId },
      data: {
        status: BankConnectionStatus.NOT_LINKED,
        providerMandateId: null,
        institutionName: null,
        maskedAccountNumber: null,
        accountType: null,
        authorizedAt: null,
        isSimulated: true,
      },
    });
  }

  logger.info("Bank account disconnected", { context: { sessionId } });

  return {
    status: "not_linked",
    account: null,
    notice: "Bank account disconnected. Switched to explore-only mode.",
    isSimulated: true,
  };
}


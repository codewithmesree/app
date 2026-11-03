"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { SAMPLE_LINKED_ACCOUNT } from "./bank-linking-mock-data";
import {
  isPaymentEligible,
  type BankLinkingState,
  type BankLinkingStatus,
  type LinkedBankAccount,
} from "./bank-linking-types";

type BankLinkingContextValue = {
  state: BankLinkingState;
  isPaymentEligible: boolean;
  startLinking: () => void;
  completeLinking: (account?: Partial<LinkedBankAccount>) => void;
  failLinking: (reason?: string) => void;
  expireConnection: () => void;
  requireReconnection: () => void;
  disconnect: () => void;
  resetToUnlinked: () => void;
  setMockStatus: (status: BankLinkingStatus) => void;
};

const BankLinkingContext = createContext<BankLinkingContextValue | null>(null);

const STORAGE_KEY = "globalpay_mock_bank_state";

function getInitialBankLinkingState(): BankLinkingState {
  if (typeof window !== "undefined") {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<BankLinkingState>;
        if (parsed.status) {
          return {
            status: parsed.status,
            account: parsed.account ?? (parsed.status === "linked" ? SAMPLE_LINKED_ACCOUNT : null),
            notice: parsed.notice ?? null,
            isSimulated: true,
          };
        }
      }
    } catch {
      // Storage unavailable; keep default memory state
    }
  }

  return {
    status: "not_linked",
    account: null,
    notice: null,
    isSimulated: true,
  };
}

export function BankLinkingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BankLinkingState>(getInitialBankLinkingState);

  const persistState = (next: BankLinkingState) => {
    setState(next);
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore sessionStorage errors
      }
    }
  };

  const startLinking = () => {
    persistState({
      status: "linking_in_progress",
      account: null,
      notice: "Initiating simulated Open Banking handshake...",
      isSimulated: true,
    });
  };

  const completeLinking = (accountOverride?: Partial<LinkedBankAccount>) => {
    const account: LinkedBankAccount = {
      institutionName: accountOverride?.institutionName ?? SAMPLE_LINKED_ACCOUNT.institutionName,
      maskedAccountNumber: accountOverride?.maskedAccountNumber ?? SAMPLE_LINKED_ACCOUNT.maskedAccountNumber,
      accountType: accountOverride?.accountType ?? SAMPLE_LINKED_ACCOUNT.accountType,
      holderLabel: accountOverride?.holderLabel ?? SAMPLE_LINKED_ACCOUNT.holderLabel,
      linkedAt: new Date().toISOString(),
    };
    persistState({
      status: "linked",
      account,
      notice: null,
      isSimulated: true,
    });
  };

  const failLinking = (reason?: string) => {
    persistState({
      status: "linking_failed",
      account: null,
      notice: reason ?? "Simulated bank verification timeout. No funds or credentials were transmitted.",
      isSimulated: true,
    });
  };

  const expireConnection = () => {
    persistState({
      status: "connection_expired",
      account: state.account ?? SAMPLE_LINKED_ACCOUNT,
      notice: "Simulated bank authorization token has expired.",
      isSimulated: true,
    });
  };

  const requireReconnection = () => {
    persistState({
      status: "reconnection_required",
      account: state.account ?? SAMPLE_LINKED_ACCOUNT,
      notice: "Simulated security policy requires re-authentication.",
      isSimulated: true,
    });
  };

  const disconnect = () => {
    persistState({
      status: "not_linked",
      account: null,
      notice: "Bank account disconnected. Switched to explore-only mode.",
      isSimulated: true,
    });
  };

  const resetToUnlinked = () => {
    persistState({
      status: "not_linked",
      account: null,
      notice: null,
      isSimulated: true,
    });
  };

  const setMockStatus = (status: BankLinkingStatus) => {
    switch (status) {
      case "not_linked":
        disconnect();
        break;
      case "linking_in_progress":
        startLinking();
        break;
      case "linked":
        completeLinking();
        break;
      case "linking_failed":
        failLinking();
        break;
      case "connection_expired":
        expireConnection();
        break;
      case "reconnection_required":
        requireReconnection();
        break;
    }
  };

  const value = useMemo(
    () => ({
      state,
      isPaymentEligible: isPaymentEligible(state.status),
      startLinking,
      completeLinking,
      failLinking,
      expireConnection,
      requireReconnection,
      disconnect,
      resetToUnlinked,
      setMockStatus,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state]
  );

  return <BankLinkingContext.Provider value={value}>{children}</BankLinkingContext.Provider>;
}

export function useBankLinking(): BankLinkingContextValue {
  const context = useContext(BankLinkingContext);
  if (!context) {
    throw new Error("useBankLinking must be used within BankLinkingProvider.");
  }
  return context;
}

"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
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
  startLinking: (institutionId?: unknown) => Promise<void>;
  completeLinking: (
    accountOrOptions?:
      | Partial<LinkedBankAccount>
      | { institutionId?: string; account?: Partial<LinkedBankAccount> }
  ) => Promise<void>;
  failLinking: (reason?: string, institutionId?: string) => Promise<void>;
  expireConnection: () => Promise<void>;
  requireReconnection: () => Promise<void>;
  disconnect: () => Promise<void>;
  resetToUnlinked: () => Promise<void>;
  setMockStatus: (status: BankLinkingStatus) => Promise<void>;
  refreshStatus: () => Promise<void>;
};

const BankLinkingContext = createContext<BankLinkingContextValue | null>(null);

const DEFAULT_STATE: BankLinkingState = {
  status: "not_linked",
  account: null,
  notice: null,
  isSimulated: true,
};

export function BankLinkingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BankLinkingState>(DEFAULT_STATE);

  // Fetch initial connection status from the server
  const refreshStatus = async () => {
    try {
      const res = await fetch("/api/bank-connection", {
        method: "GET",
        headers: { "Cache-Control": "no-cache" },
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.connection) {
          setState({
            status: data.connection.status,
            account: data.connection.account,
            notice: data.connection.notice,
            isSimulated: true,
          });
        }
      }
    } catch {
      // Offline or network error: retain current memory state
    }
  };

  useEffect(() => {
    let isMounted = true;
    fetch("/api/bank-connection", {
      method: "GET",
      headers: { "Cache-Control": "no-cache" },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data?.connection) {
          setState({
            status: data.connection.status,
            account: data.connection.account,
            notice: data.connection.notice,
            isSimulated: true,
          });
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  const startLinking = async (institutionId?: unknown) => {
    const validInstitutionId =
      typeof institutionId === "string" ? institutionId : "chase";

    // Optimistic state
    setState({
      status: "linking_in_progress",
      account: null,
      notice: "Initiating simulated Open Banking handshake...",
      isSimulated: true,
    });

    try {
      const res = await fetch("/api/bank-connection/link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "initiate",
          institutionId: validInstitutionId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.connection) {
          setState({
            status: data.connection.status,
            account: data.connection.account,
            notice: data.connection.notice,
            isSimulated: true,
          });
        }
      }
    } catch {
      // Retain optimistic in-memory state on network error
    }
  };

  const completeLinking = async (
    accountOrOptions?:
      | Partial<LinkedBankAccount>
      | { institutionId?: string; account?: Partial<LinkedBankAccount> }
  ) => {
    let institutionId = "chase";
    let accountOverride: Partial<LinkedBankAccount> | undefined;

    if (accountOrOptions) {
      if ("institutionId" in accountOrOptions && accountOrOptions.institutionId) {
        institutionId = accountOrOptions.institutionId;
        accountOverride = accountOrOptions.account;
      } else {
        accountOverride = accountOrOptions as Partial<LinkedBankAccount>;
      }
    }

    try {
      const res = await fetch("/api/bank-connection/link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "complete",
          institutionId,
          simulateFailure: false,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.connection) {
          setState({
            status: data.connection.status,
            account: data.connection.account,
            notice: data.connection.notice,
            isSimulated: true,
          });
          return;
        }
      }
    } catch {
      // Fallback to local state if offline
    }

    // Fallback local update
    setState({
      status: "linked",
      account: {
        institutionName: accountOverride?.institutionName ?? SAMPLE_LINKED_ACCOUNT.institutionName,
        maskedAccountNumber: accountOverride?.maskedAccountNumber ?? SAMPLE_LINKED_ACCOUNT.maskedAccountNumber,
        accountType: accountOverride?.accountType ?? SAMPLE_LINKED_ACCOUNT.accountType,
        holderLabel: accountOverride?.holderLabel ?? SAMPLE_LINKED_ACCOUNT.holderLabel,
        linkedAt: new Date().toISOString(),
      },
      notice: null,
      isSimulated: true,
    });
  };

  const failLinking = async (reason?: string, institutionId = "chase") => {
    const errorMsg =
      reason ?? "Simulated bank verification timeout. No funds or credentials were transmitted.";

    try {
      const res = await fetch("/api/bank-connection/link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "complete",
          institutionId,
          simulateFailure: true,
          failureReason: errorMsg,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.connection) {
          setState({
            status: data.connection.status,
            account: null,
            notice: data.connection.notice,
            isSimulated: true,
          });
          return;
        }
      }
    } catch {
      // Fallback
    }

    setState({
      status: "linking_failed",
      account: null,
      notice: errorMsg,
      isSimulated: true,
    });
  };

  const expireConnection = async () => {
    try {
      const res = await fetch("/api/bank-connection/link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "simulate_status",
          status: "connection_expired",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.connection) {
          setState({
            status: data.connection.status,
            account: data.connection.account,
            notice: data.connection.notice,
            isSimulated: true,
          });
          return;
        }
      }
    } catch {
      // Fallback
    }

    setState((prev) => ({
      status: "connection_expired",
      account: prev.account ?? SAMPLE_LINKED_ACCOUNT,
      notice: "Simulated bank authorization token has expired.",
      isSimulated: true,
    }));
  };

  const requireReconnection = async () => {
    try {
      const res = await fetch("/api/bank-connection/link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "simulate_status",
          status: "reconnection_required",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.connection) {
          setState({
            status: data.connection.status,
            account: data.connection.account,
            notice: data.connection.notice,
            isSimulated: true,
          });
          return;
        }
      }
    } catch {
      // Fallback
    }

    setState((prev) => ({
      status: "reconnection_required",
      account: prev.account ?? SAMPLE_LINKED_ACCOUNT,
      notice: "Simulated security policy requires re-authentication.",
      isSimulated: true,
    }));
  };

  const disconnect = async () => {
    try {
      const res = await fetch("/api/bank-connection", {
        method: "DELETE",
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.connection) {
          setState({
            status: data.connection.status,
            account: null,
            notice: data.connection.notice,
            isSimulated: true,
          });
          return;
        }
      }
    } catch {
      // Fallback
    }

    setState({
      status: "not_linked",
      account: null,
      notice: "Bank account disconnected. Switched to explore-only mode.",
      isSimulated: true,
    });
  };

  const resetToUnlinked = async () => {
    await disconnect();
  };

  const setMockStatus = async (status: BankLinkingStatus) => {
    switch (status) {
      case "not_linked":
        await disconnect();
        break;
      case "linking_in_progress":
        await startLinking();
        break;
      case "linked":
        await completeLinking();
        break;
      case "linking_failed":
        await failLinking();
        break;
      case "connection_expired":
        await expireConnection();
        break;
      case "reconnection_required":
        await requireReconnection();
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
      refreshStatus,
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

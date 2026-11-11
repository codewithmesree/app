"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  isPaymentEligible,
  type BankLinkingState,
  type BankLinkingStatus,
  type LinkedBankAccount,
} from "./bank-linking-types";

type BankLinkingContextValue = {
  state: BankLinkingState;
  operationError: string | null;
  isPaymentEligible: boolean;
  startLinking: (institutionId?: unknown) => Promise<void>;
  completeLinking: (options?: { institutionId?: string }) => Promise<void>;
  failLinking: (reason?: string, institutionId?: string) => Promise<void>;
  expireConnection: () => Promise<void>;
  requireReconnection: () => Promise<void>;
  disconnect: () => Promise<void>;
  resetToUnlinked: () => Promise<void>;
  setMockStatus: (status: BankLinkingStatus) => Promise<void>;
  refreshStatus: () => Promise<void>;
};

const BankLinkingContext = createContext<BankLinkingContextValue | null>(null);

const BANK_STATUSES: readonly BankLinkingStatus[] = [
  "not_linked",
  "linking_in_progress",
  "linked",
  "linking_failed",
  "connection_expired",
  "reconnection_required",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseConnection(value: unknown): BankLinkingState {
  if (!isRecord(value) || typeof value.status !== "string" || !BANK_STATUSES.includes(value.status as BankLinkingStatus)) {
    throw new Error("The bank-connection response was invalid.");
  }
  if (value.account !== null && value.account !== undefined) {
    if (
      !isRecord(value.account) ||
      typeof value.account.institutionName !== "string" ||
      typeof value.account.maskedAccountNumber !== "string" ||
      typeof value.account.accountType !== "string" ||
      typeof value.account.linkedAt !== "string"
    ) {
      throw new Error("The bank-connection response was invalid.");
    }
  }
  if (value.notice !== null && value.notice !== undefined && typeof value.notice !== "string") {
    throw new Error("The bank-connection response was invalid.");
  }

  return {
    status: value.status as BankLinkingStatus,
    account: value.account == null ? null : (value.account as LinkedBankAccount),
    notice: (value.notice as string | null | undefined) ?? null,
    isSimulated: true,
  };
}

async function getConnectionResponse(response: Response): Promise<BankLinkingState> {
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message =
      isRecord(payload) &&
      isRecord(payload.error) &&
      typeof payload.error.message === "string"
        ? payload.error.message
        : "The bank-connection request could not be completed.";
    throw new Error(message);
  }
  if (!isRecord(payload) || !("connection" in payload)) {
    throw new Error("The bank-connection response was invalid.");
  }
  return parseConnection(payload.connection);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The bank-connection request could not be completed.";
}

const DEFAULT_STATE: BankLinkingState = {
  status: "not_linked",
  account: null,
  notice: null,
  isSimulated: true,
};

export function BankLinkingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BankLinkingState>(DEFAULT_STATE);
  const [operationError, setOperationError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/bank-connection", {
        method: "GET",
        cache: "no-store",
      });
      setState(await getConnectionResponse(res));
      setOperationError(null);
    } catch (error) {
      setOperationError(getErrorMessage(error));
    }
  }, []);

  useEffect(() => {
    let active = true;
    void fetch("/api/bank-connection", {
      method: "GET",
      cache: "no-store",
    })
      .then(getConnectionResponse)
      .then((connection) => {
        if (active) {
          setState(connection);
          setOperationError(null);
        }
      })
      .catch((error: unknown) => {
        if (active) setOperationError(getErrorMessage(error));
      });

    return () => {
      active = false;
    };
  }, []);

  const startLinking = async (institutionId?: unknown) => {
    const validInstitutionId =
      typeof institutionId === "string" ? institutionId : "chase";

    const previousState = state;
    setOperationError(null);
    setState({
      status: "linking_in_progress",
      account: null,
      notice: "Initiating simulated bank-linking handshake...",
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
      setState(await getConnectionResponse(res));
    } catch (error) {
      setState(previousState);
      setOperationError(getErrorMessage(error));
    }
  };

  const completeLinking = async (options?: { institutionId?: string }) => {
    const institutionId = options?.institutionId ?? "chase";
    setOperationError(null);

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
      setState(await getConnectionResponse(res));
    } catch (error) {
      setOperationError(getErrorMessage(error));
    }
  };

  const failLinking = async (reason?: string, institutionId = "chase") => {
    const errorMsg =
      reason ?? "Simulated bank verification timeout. No funds or credentials were transmitted.";

    setOperationError(null);
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
      setState(await getConnectionResponse(res));
    } catch (error) {
      setOperationError(getErrorMessage(error));
    }
  };

  const expireConnection = async () => {
    setOperationError(null);
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
      setState(await getConnectionResponse(res));
    } catch (error) {
      setOperationError(getErrorMessage(error));
    }
  };

  const requireReconnection = async () => {
    setOperationError(null);
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
      setState(await getConnectionResponse(res));
    } catch (error) {
      setOperationError(getErrorMessage(error));
    }
  };

  const disconnect = async () => {
    setOperationError(null);
    try {
      const res = await fetch("/api/bank-connection", {
        method: "DELETE",
      });
      setState(await getConnectionResponse(res));
    } catch (error) {
      setOperationError(getErrorMessage(error));
    }
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
      operationError,
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
    [state, operationError]
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

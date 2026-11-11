"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { RecentTransactionsCard } from "@/components/dashboard/recent-transactions-card";
import type { TransactionSummary, TransactionsState } from "@/features/payment/payment-types";

interface ApiTransactionItem {
  id: string;
  merchant: {
    id: string;
    name: string;
    category: string;
  };
  amount: string;
  currency: string;
  status: TransactionSummary["status"];
  createdAt: string;
}

export function TransactionsPageClient() {
  const [state, setState] = useState<TransactionsState>({ status: "loading" });
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    fetch("/api/transactions", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !Array.isArray(data?.transactions)) {
          throw new Error("Transaction history could not be loaded.");
        }
        return data;
      })
      .then((data) => {
        if (!isMounted) return;
        const items: TransactionSummary[] = (data.transactions as ApiTransactionItem[]).map((t) => ({
          id: t.id,
          merchant: {
            id: t.merchant.id,
            name: t.merchant.name,
            category: t.merchant.category.toLowerCase() as TransactionSummary["merchant"]["category"],
          },
          amount: t.amount,
          currency: t.currency,
          status: t.status,
          createdAt: t.createdAt,
          updatedAt: t.createdAt,
        }));
        setState({ status: "ready", items });
      })
      .catch(() => {
        if (!isMounted) return;
        setState({ status: "error" });
      });

    return () => {
      isMounted = false;
    };
  }, [retryCount]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Transaction History"
        description="Review previous demonstration payment attempts and their authoritative status."
      />
      <RecentTransactionsCard
        state={state}
        onRetry={() => {
          setState({ status: "loading" });
          setRetryCount((count) => count + 1);
        }}
      />
    </div>
  );
}

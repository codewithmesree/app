"use client";

import { ReceiptText } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { TransactionListItem } from "@/components/transactions/transaction-list-item";
import { TransactionReceiptDrawer } from "@/components/transactions/transaction-receipt-drawer";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import { Skeleton } from "@/components/ui/skeleton";
import type { TransactionsState, TransactionSummary } from "@/features/payment/payment-types";

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

export function RecentTransactionsCard({
  state: initialOverrideState,
  onRetry,
}: {
  state?: TransactionsState;
  onRetry?: () => void;
}) {
  const [liveState, setLiveState] = useState<TransactionsState>(
    initialOverrideState || { status: "loading" }
  );
  const [retryCount, setRetryCount] = useState(0);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const closeReceipt = useCallback(() => setSelectedTransactionId(null), []);

  useEffect(() => {
    // If an explicit override state was provided (e.g. from a preview query param),
    // it was already used to initialise useState — no synchronous setState needed here.
    if (initialOverrideState) return;

    let isMounted = true;

    fetch("/api/transactions", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !Array.isArray(data?.transactions)) {
          throw new Error("Transaction activity could not be loaded.");
        }
        return data;
      })
      .then((data) => {
        if (!isMounted) return;
        const items: TransactionSummary[] = (data.transactions as ApiTransactionItem[])
          .slice(0, 4)
          .map((t) => ({
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
        setLiveState({ status: "ready", items });
      })
      .catch(() => {
        if (!isMounted) return;
        setLiveState({ status: "error" });
      });

    return () => {
      isMounted = false;
    };
  }, [initialOverrideState, retryCount]);

  const retry = () => {
    if (onRetry) {
      onRetry();
    } else {
      setLiveState({ status: "loading" });
      setRetryCount((count) => count + 1);
    }
  };

  const state = liveState;
  const hasItems = state.status === "ready" && state.items.length > 0;
  const isPreview = Boolean(initialOverrideState);

  return (
    <Card aria-labelledby="recent-heading" aria-busy={state.status === "loading"} className="flex h-full flex-col gap-4">
      <SectionHeader
        id="recent-heading"
        title="Recent activity"
        aside={
          hasItems ? (
            <div className="flex items-center gap-3">
              <Badge tone={isPreview ? "neutral" : "info"}>
                {isPreview ? "Sample data" : "Session activity"}
              </Badge>
              <Link
                href="/transactions"
                className="inline-flex min-h-11 items-center rounded px-1 text-sm font-medium text-primary-hover underline-offset-4 hover:underline"
              >
                View all
              </Link>
            </div>
          ) : null
        }
      />
      {state.status === "loading" ? <TransactionsSkeleton /> : null}
      {state.status === "error" ? (
        <div className="flex flex-col gap-3">
          <Alert tone="danger" title="Activity unavailable">
            Transaction activity could not be loaded. Your saved transactions have not been changed.
          </Alert>
          <button
            type="button"
            onClick={retry}
            className="min-h-10 self-start rounded-control border border-line px-4 text-sm font-medium text-ink hover:bg-surface-raised"
          >
            Retry
          </button>
        </div>
      ) : null}
      {state.status === "ready" && !hasItems ? (
        <EmptyState
          icon={ReceiptText}
          title="No activity yet"
          description="Your payment attempts will appear here after you create a demo payment."
          action={
            <ButtonLink href="/merchants" variant="secondary">
              Explore demo merchants
            </ButtonLink>
          }
        />
      ) : null}
      {state.status === "ready" && hasItems ? (
        <ul className="divide-y divide-line">
          {state.items.map((transaction) => (
            <TransactionListItem
              key={transaction.id}
              transaction={transaction}
              onSelect={() => setSelectedTransactionId(transaction.id)}
            />
          ))}
        </ul>
      ) : null}
      {selectedTransactionId ? (
        <TransactionReceiptDrawer
          key={selectedTransactionId}
          transactionId={selectedTransactionId}
          onClose={closeReceipt}
        />
      ) : null}
    </Card>
  );
}

function TransactionsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <p className="sr-only" role="status">
        Loading recent transactions
      </p>
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex justify-between gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-36 max-w-full" />
            <Skeleton className="h-3 w-44 max-w-full" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col items-end gap-2">
            <Skeleton className="h-4 w-20 max-w-full" />
            <Skeleton className="h-5 w-32 max-w-full rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

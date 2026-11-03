import { ReceiptText } from "lucide-react";
import Link from "next/link";
import { TransactionListItem } from "@/components/transactions/transaction-list-item";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import { Skeleton } from "@/components/ui/skeleton";
import type { TransactionsState } from "@/features/payment/payment-types";

export function RecentTransactionsCard({ state }: { state: TransactionsState }) {
  const hasItems = state.status === "ready" && state.items.length > 0;

  return (
    <Card aria-labelledby="recent-heading" aria-busy={state.status === "loading"} className="flex h-full flex-col gap-4">
      <SectionHeader
        id="recent-heading"
        title="Recent activity"
        aside={
          hasItems ? (
            <div className="flex items-center gap-3">
              <Badge>Sample data</Badge>
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
      {state.status === "ready" && !hasItems ? (
        <EmptyState
          icon={ReceiptText}
          title="No activity yet"
          description="Your activity will appear here after you try a demo payment."
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
            <TransactionListItem key={transaction.id} transaction={transaction} />
          ))}
        </ul>
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

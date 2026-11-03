"use client";

import { PageHeader } from "@/components/ui/page-header";
import { RecentTransactionsCard } from "@/components/dashboard/recent-transactions-card";
import { getDashboardData } from "@/features/dashboard/sample-data";

export function TransactionsPageClient() {
  const { transactions } = getDashboardData("sample");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Transaction History"
        description="Review previous demonstration payment attempts and their authoritative status."
      />
      <RecentTransactionsCard state={transactions} />
    </div>
  );
}

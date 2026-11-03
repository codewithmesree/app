import type { Metadata } from "next";
import { DashboardWorkspace } from "@/components/dashboard/dashboard-workspace";
import { QuickLinks } from "@/components/dashboard/quick-links";
import { RecentTransactionsCard } from "@/components/dashboard/recent-transactions-card";
import { SampleDataNotice } from "@/components/dashboard/sample-data-notice";
import { Reveal } from "@/components/motion/reveal";
import { getDashboardData, parsePreviewState } from "@/features/dashboard/sample-data";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const preview = parsePreviewState((await searchParams).preview);
  const { rateStatus, transactions } = getDashboardData(preview);

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <DashboardWorkspace rateStatus={rateStatus} notice={<SampleDataNotice current={preview} />} />
      <Reveal order={3}>
        <RecentTransactionsCard state={transactions} />
      </Reveal>
      <Reveal order={4}>
        <QuickLinks />
      </Reveal>
    </div>
  );
}

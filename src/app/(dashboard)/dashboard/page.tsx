import type { Metadata } from "next";
import { DashboardWorkspace } from "@/components/dashboard/dashboard-workspace";
import { QuickLinks } from "@/components/dashboard/quick-links";
import { RecentTransactionsCard } from "@/components/dashboard/recent-transactions-card";
import { SampleDataNotice } from "@/components/dashboard/sample-data-notice";
import { Reveal } from "@/components/motion/reveal";
import { getDashboardData, parsePreviewState } from "@/features/dashboard/sample-data";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const params = await searchParams;
  const rawPreview = params.preview;
  const preview = parsePreviewState(rawPreview);
  const { rateStatus, transactions } = getDashboardData(preview);

  // If the user explicitly provided a ?preview= query param, pass override mock transactions; otherwise let RecentTransactionsCard fetch live session transactions.
  const overrideState = rawPreview ? transactions : undefined;

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <DashboardWorkspace rateStatus={rateStatus} notice={<SampleDataNotice current={preview} />} />
      <Reveal order={3}>
        <RecentTransactionsCard state={overrideState} />
      </Reveal>
      <Reveal order={4}>
        <QuickLinks />
      </Reveal>
    </div>
  );
}

import type { Metadata } from "next";
import { TransactionsPageClient } from "@/components/transactions/transactions-page-client";

export const metadata: Metadata = {
  title: "Transaction History",
  description: "Review your demo payment attempts and their status.",
};

export default function TransactionsPage() {
  return <TransactionsPageClient />;
}

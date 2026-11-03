import type { Metadata } from "next";
import { PayPageClient } from "@/components/payment/pay-page-client";

export const metadata: Metadata = {
  title: "Pay Merchant",
  description: "Review test payment details and authorize checkout via linked bank account.",
};

export default function PayPage() {
  return <PayPageClient />;
}

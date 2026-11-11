import type { Metadata } from "next";
import { PaymentCancelClient } from "@/components/payment/payment-cancel-client";

export const metadata: Metadata = {
  title: "Payment Cancelled",
  description: "PayPal Sandbox payment checkout cancelled.",
};

export default function PaymentCancelPage() {
  return <PaymentCancelClient />;
}


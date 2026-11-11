import type { Metadata } from "next";
import { Suspense } from "react";
import { PaymentReturnClient } from "@/components/payment/payment-return-client";

export const metadata: Metadata = {
  title: "Confirming Payment",
  description: "Confirming and capturing PayPal Sandbox payment.",
};

export default function PaymentReturnPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-ink-muted">Loading payment details...</div>}>
      <PaymentReturnClient />
    </Suspense>
  );
}


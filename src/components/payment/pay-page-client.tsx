"use client";

import { useBankLinking } from "@/features/bank-linking/bank-linking-context";
import { BankLinkingFlowView } from "@/components/bank-linking/bank-linking-flow-view";
import { PaymentReviewScreen } from "@/components/payment/payment-review-screen";

export function PayPageClient() {
  const { isPaymentEligible } = useBankLinking();

  if (!isPaymentEligible) {
    return (
      <BankLinkingFlowView
        returnTo="/dashboard"
        contextNotice="Bank account linking is required to access merchant payments."
      />
    );
  }

  return <PaymentReviewScreen />;
}


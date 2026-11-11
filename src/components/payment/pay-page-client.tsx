"use client";

import { useBankLinking } from "@/features/bank-linking/bank-linking-context";
import { BankLinkingFlowView } from "@/components/bank-linking/bank-linking-flow-view";
import { PaymentReviewScreen } from "@/components/payment/payment-review-screen";

type PayPageClientProps = {
  merchantId?: string | null;
};

export function PayPageClient({ merchantId }: PayPageClientProps) {
  const { isPaymentEligible } = useBankLinking();

  if (!isPaymentEligible) {
    return (
      <BankLinkingFlowView
        returnTo={merchantId ? "/merchants" : "/dashboard"}
        contextNotice="Bank account linking is required to access merchant payments."
      />
    );
  }

  return <PaymentReviewScreen merchantId={merchantId} />;
}

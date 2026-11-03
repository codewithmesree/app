import type { Metadata } from "next";
import { BankLinkingFlowView } from "@/components/bank-linking/bank-linking-flow-view";

export const metadata: Metadata = {
  title: "Connect Bank Account",
  description: "Link your bank account via open-banking simulation to enable travel payments.",
};

export default function ConnectBankPage() {
  return <BankLinkingFlowView returnTo="/dashboard" />;
}


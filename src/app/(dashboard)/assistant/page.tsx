import type { Metadata } from "next";
import { AssistantClient } from "@/components/assistant/assistant-client";

export const metadata: Metadata = {
  title: "Travel Payment Assistant",
  description: "AI-powered general guidance about GlobalPay's demo payments, exchange estimates, and security.",
};

export default function AssistantPage() {
  return <AssistantClient />;
}

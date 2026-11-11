import type { Metadata } from "next";
import { AssistantClient } from "@/components/assistant/assistant-client";

export const metadata: Metadata = {
  title: "Travel Guidance",
  description: "Read-only travel payment explanations and security guidance.",
};

export default function AssistantPage() {
  return <AssistantClient />;
}

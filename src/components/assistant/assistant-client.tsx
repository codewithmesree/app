"use client";

import {
  ArrowRight,
  Bot,
  HelpCircle,
  Lock,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Reveal } from "@/components/motion/reveal";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { useBankLinking } from "@/features/bank-linking/bank-linking-context";

type FaqItem = {
  question: string;
  answer: string;
  topic: string;
};

const FAQ_ITEMS: FaqItem[] = [
  {
    topic: "Payment Access",
    question: "Why do I need to connect a bank account to pay merchants?",
    answer:
      "GlobalPay requires an authorized bank connection to confirm payment intent and initiate sandbox transactions. Explore features like currency estimates and merchant discovery do not require linking.",
  },
  {
    topic: "Security",
    question: "Does GlobalPay store my banking login password or PIN?",
    answer:
      "No. GlobalPay never asks for, sees, or stores your bank credentials. In production, authorization is delegated to regulated Open Banking providers via OAuth tokens.",
  },
  {
    topic: "AI Guardrails",
    question: "Can the AI Assistant link my bank or approve payments for me?",
    answer:
      "No. Following our security model and AI guardrails, the AI assistant is strictly read-only and explanatory. It cannot initiate, link, approve, or capture payments.",
  },
  {
    topic: "Currencies",
    question: "Are the exchange rates guaranteed market rates?",
    answer:
      "No. All exchange rates displayed in GlobalPay are indicative estimates for demonstration. The final converted charge is determined by PayPal at checkout time.",
  },
];

export function AssistantClient() {
  const { isPaymentEligible, state } = useBankLinking();
  const [selectedTopic, setSelectedTopic] = useState<string>("All");

  const topics = ["All", "Payment Access", "Security", "AI Guardrails", "Currencies"];
  const filteredFaqs =
    selectedTopic === "All" ? FAQ_ITEMS : FAQ_ITEMS.filter((item) => item.topic === selectedTopic);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="AI Assistant & Guidance"
        description="Read-only travel payment explanations and security guidance. The assistant cannot approve or mutate payments."
        aside={
          <Badge tone="info" icon={<Bot aria-hidden className="size-3.5" />}>
            Read-Only Explanatory Assistant
          </Badge>
        }
      />

      <Alert tone="info" title="AI Guardrail Notice">
        In accordance with GlobalPay security policy, the AI assistant operates strictly within a read-only boundary.
        It cannot execute bank linking, modify accounts, or approve payment transactions.
      </Alert>

      {/* Account Status Card */}
      <Reveal>
        <Card className="flex flex-col gap-3 p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="label-mono text-ink-muted">Your Payment Eligibility Status</span>
            {isPaymentEligible ? (
              <Badge tone="success" icon={<ShieldCheck aria-hidden className="size-3.5" />}>
                Payment-Enabled ({state.account?.maskedAccountNumber})
              </Badge>
            ) : (
              <Badge tone="neutral" icon={<Lock aria-hidden className="size-3.5" />}>
                Explore-Only User (Bank Not Linked)
              </Badge>
            )}
          </div>
          <p className="text-sm text-ink-muted">
            {isPaymentEligible
              ? "Your account is linked with a verified sandbox test mandate. You can access PayPal Sandbox payment flows."
              : "You are currently in explore-only mode. You have full access to exchange rates and merchants. To initiate test payments, connect a bank account."}
          </p>
          {!isPaymentEligible ? (
            <div className="pt-2">
              <Link
                href="/connect-bank"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-control bg-lavender px-4 text-xs font-semibold text-on-lavender hover:bg-lavender-hover"
              >
                Connect bank account
                <ArrowRight aria-hidden className="size-4 shrink-0" />
              </Link>
            </div>
          ) : null}
        </Card>
      </Reveal>

      {/* Topic Filter */}
      <div className="flex flex-wrap gap-2">
        {topics.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setSelectedTopic(t)}
            className={`rounded-control px-3 py-1.5 text-xs font-medium transition ${
              selectedTopic === t
                ? "border border-lavender bg-primary-soft text-lavender ring-1 ring-lavender/30"
                : "border border-line bg-surface-muted text-ink-muted hover:border-ink-subtle hover:text-ink"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* FAQ Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {filteredFaqs.map((faq, idx) => (
          <Reveal key={faq.question} order={idx}>
            <Card className="flex h-full flex-col justify-between gap-3 p-4 sm:p-5">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Badge>{faq.topic}</Badge>
                  <HelpCircle aria-hidden className="size-4 text-ink-muted" />
                </div>
                <h3 className="text-sm font-semibold text-ink">{faq.question}</h3>
                <p className="text-xs leading-relaxed text-ink-muted">{faq.answer}</p>
              </div>
            </Card>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

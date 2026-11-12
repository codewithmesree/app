"use client";

import {
  ArrowRight,
  HelpCircle,
  Lock,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { useBankLinking } from "@/features/bank-linking/bank-linking-context";

type ChatMessage = {
  id: string;
  role: "user" | "model";
  content: string;
};

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "model",
  content: "Hi! I can answer general questions about GlobalPay's demo payment flow, exchange estimates, and security.",
};

const SUGGESTED_QUESTIONS = [
  "How do demo payments work?",
  "Why are exchange rates indicative?",
  "What does simulated bank linking mean?",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function AssistantClient() {
  const { isPaymentEligible, state } = useBankLinking();
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isSending]);

  async function sendMessage(rawMessage: string) {
    const content = rawMessage.trim();
    if (!content || isSending) return;

    const priorMessages = messages
      .filter((message) => message.id !== WELCOME_MESSAGE.id)
      .slice(-10)
      .map(({ role, content: messageContent }) => ({ role, content: messageContent }));
    const requestMessages = [...priorMessages, { role: "user" as const, content }];

    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", content },
    ]);
    setInput("");
    setErrorMessage(null);
    setIsSending(true);

    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: requestMessages }),
        cache: "no-store",
      });

      let data: unknown;
      try {
        data = await response.json();
      } catch {
        throw new Error("The travel assistant returned an unreadable response. Please try again.");
      }

      if (!response.ok) {
        const apiError = isRecord(data) && isRecord(data.error) ? data.error : null;
        throw new Error(
          apiError && typeof apiError.message === "string"
            ? apiError.message
            : "The travel assistant could not respond. Please try again."
        );
      }

      if (!isRecord(data) || typeof data.reply !== "string" || !data.reply.trim()) {
        throw new Error("The travel assistant returned an invalid response. Please try again.");
      }

      const reply = data.reply;
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "model", content: reply },
      ]);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "The travel assistant could not respond. Please try again."
      );
    } finally {
      setIsSending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Travel Payment Assistant"
        description="Ask about GlobalPay's demo payment flow, indicative exchange estimates, and security."
        aside={
          <Badge tone="info" icon={<Sparkles aria-hidden className="size-3.5" />}>
            Gemini guidance
          </Badge>
        }
      />

      <Alert tone="info" title="Informational guidance only">
        When configured, your messages are sent to Gemini. Do not share passwords, bank details, card numbers, or API
        keys. The assistant cannot access your account or perform payments or bank-linking actions.
      </Alert>

      <Card className="overflow-hidden p-0">
        <div
          aria-label="Chat messages"
          aria-live="polite"
          className="flex min-h-[320px] max-h-[58dvh] flex-col gap-4 overflow-y-auto p-4 sm:min-h-[380px] sm:p-6"
          role="log"
        >
          {messages.map((message) => {
            const isUser = message.role === "user";
            return (
              <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[90%] whitespace-pre-wrap break-words rounded-card px-4 py-3 text-sm sm:max-w-[80%] ${
                    isUser
                      ? "bg-primary-solid text-white"
                      : "border border-line bg-surface-raised text-ink"
                  }`}
                >
                  <p className={`mb-1 text-[11px] font-semibold ${isUser ? "text-white/75" : "text-lavender"}`}>
                    {isUser ? "You" : "GlobalPay Guide"}
                  </p>
                  <p>{message.content}</p>
                </div>
              </div>
            );
          })}
          {isSending ? (
            <p className="text-sm text-ink-muted" role="status">
              GlobalPay Guide is thinking…
            </p>
          ) : null}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-line bg-surface-raised/50 p-4 sm:p-6">
          {messages.length === 1 ? (
            <div className="mb-4 flex flex-wrap gap-2">
              {SUGGESTED_QUESTIONS.map((question) => (
                <button
                  key={question}
                  type="button"
                  disabled={isSending}
                  onClick={() => void sendMessage(question)}
                  className="min-h-10 rounded-full border border-line bg-surface px-3 py-2 text-xs text-ink-muted transition hover:border-lavender hover:text-ink disabled:opacity-50"
                >
                  {question}
                </button>
              ))}
            </div>
          ) : null}

          {errorMessage ? (
            <Alert tone="danger" title="Message not sent">
              {errorMessage}
            </Alert>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-3 flex items-end gap-3">
            <label className="sr-only" htmlFor="assistant-message">
              Your message
            </label>
            <textarea
              id="assistant-message"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              maxLength={2_000}
              rows={2}
              placeholder="Ask a question…"
              className="min-h-11 min-w-0 flex-1 resize-y rounded-control border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              disabled={isSending}
            />
            <Button
              type="submit"
              loading={isSending}
              disabled={!input.trim()}
              aria-label="Send message"
              className="size-11 min-h-11 shrink-0 px-0"
            >
              <Send aria-hidden className="size-4" />
            </Button>
          </form>
          <p className="mt-2 text-xs text-ink-subtle">Responses may be inaccurate. Verify important information.</p>
        </div>
      </Card>

      <Card className="flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="label-mono text-ink-muted">Your payment eligibility status</span>
          {isPaymentEligible ? (
            <Badge tone="success" icon={<ShieldCheck aria-hidden className="size-3.5" />}>
              Payment-enabled ({state.account?.maskedAccountNumber})
            </Badge>
          ) : (
            <Badge tone="neutral" icon={<Lock aria-hidden className="size-3.5" />}>
              Explore-only · bank not linked
            </Badge>
          )}
        </div>
        {!isPaymentEligible ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-muted">
              Linking is simulated and only required for the PayPal Sandbox demo flow.
            </p>
            <Link
              href="/connect-bank"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-control bg-lavender px-4 text-xs font-semibold text-on-lavender hover:bg-lavender-hover"
            >
              Connect bank account
              <ArrowRight aria-hidden className="size-4 shrink-0" />
            </Link>
          </div>
        ) : (
          <p className="text-sm text-ink-muted">
            The linked status is simulated. The assistant cannot change it or access payment details.
          </p>
        )}
      </Card>

      <p className="flex items-center gap-2 text-xs text-ink-subtle">
        <HelpCircle aria-hidden className="size-4 shrink-0" />
        Chat messages are temporary and are not saved to transaction history.
      </p>
    </div>
  );
}

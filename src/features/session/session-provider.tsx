"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type SessionState = "loading" | "ready" | "error";

let sessionBootstrap: Promise<void> | null = null;

function establishDemoSession(): Promise<void> {
  if (!sessionBootstrap) {
    sessionBootstrap = fetch("/api/session", {
      method: "POST",
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = (await response.json()) as {
          session?: { id?: unknown };
          error?: { message?: unknown };
        };
        if (!response.ok) {
          throw new Error(
            typeof payload.error?.message === "string"
              ? payload.error.message
              : "The demo session could not be established."
          );
        }
        if (typeof payload.session?.id !== "string") {
          throw new Error("The demo session response was invalid.");
        }
      })
      .catch((error: unknown) => {
        sessionBootstrap = null;
        throw error;
      });
  }

  return sessionBootstrap;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;
    void establishDemoSession()
      .then(() => {
        if (active) setState("ready");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "The demo session could not be established. Please try again."
        );
        setState("error");
      });

    return () => {
      active = false;
    };
  }, [retryCount]);

  if (state === "loading") {
    return (
      <main className="mx-auto grid min-h-dvh max-w-xl place-items-center px-6">
        <p role="status" className="text-sm text-ink-muted">
          Restoring your secure demo session…
        </p>
      </main>
    );
  }

  if (state === "error") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-6">
        <Alert tone="danger" title="Could not restore your demo session">
          {errorMessage}
        </Alert>
        <Button
          variant="primary"
          onClick={() => {
            setErrorMessage(null);
            setState("loading");
            setRetryCount((count) => count + 1);
          }}
        >
          Retry
        </Button>
      </main>
    );
  }

  return children;
}

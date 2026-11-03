"use client";

import { useBankLinking } from "@/features/bank-linking/bank-linking-context";
import {
  BANK_STATUS_CONFIG,
  type BankLinkingStatus,
} from "@/features/bank-linking/bank-linking-types";

const ALL_STATUSES: BankLinkingStatus[] = [
  "not_linked",
  "linking_in_progress",
  "linked",
  "linking_failed",
  "connection_expired",
  "reconnection_required",
];

export function BankStateSwitcher() {
  const { state, setMockStatus } = useBankLinking();

  return (
    <div className="flex flex-col gap-2.5 rounded-card border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="label-mono text-ink-muted">Demo bank state switcher</h3>
        <span className="font-mono text-xs text-lavender">Frontend testing controls</span>
      </div>
      <p className="text-xs text-ink-muted">
        Switch bank connection states to test explore-only browsing, payment access gating, error recovery,
        and re-authentication flows immediately.
      </p>
      <div className="flex flex-wrap gap-1.5 pt-1">
        {ALL_STATUSES.map((status) => {
          const isSelected = state.status === status;
          const config = BANK_STATUS_CONFIG[status];
          return (
            <button
              key={status}
              type="button"
              onClick={() => setMockStatus(status)}
              className={`rounded-control px-2.5 py-1 text-xs font-medium transition-all ${
                isSelected
                  ? "border border-lavender bg-primary-soft text-lavender ring-1 ring-lavender/30"
                  : "border border-line bg-surface-muted text-ink-muted hover:border-ink-subtle hover:text-ink"
              }`}
            >
              {config.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}


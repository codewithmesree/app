import type { ReactNode } from "react";
import type { StatusTone } from "@/features/payment/payment-status";

const TONES: Record<StatusTone, string> = {
  neutral: "border-line bg-surface-muted text-ink-muted",
  info: "border-info/30 bg-info/10 text-info",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-danger/30 bg-danger/10 text-danger",
};

type BadgeProps = {
  tone?: StatusTone;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function Badge({ tone = "neutral", icon, className = "", children }: BadgeProps) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONES[tone]} ${className}`}
    >
      {icon}
      {children}
    </span>
  );
}

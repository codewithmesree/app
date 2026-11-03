import { CircleAlert, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type AlertTone = "info" | "warning" | "danger";

const TONES: Record<AlertTone, { icon: LucideIcon; box: string; iconColor: string }> = {
  info: { icon: Info, box: "border-info/25 bg-info/5", iconColor: "text-info" },
  warning: { icon: TriangleAlert, box: "border-warning/25 bg-warning/5", iconColor: "text-warning" },
  danger: { icon: CircleAlert, box: "border-danger/25 bg-danger/5", iconColor: "text-danger" },
};

type AlertProps = {
  tone?: AlertTone;
  title?: string;
  children: ReactNode;
};

export function Alert({ tone = "info", title, children }: AlertProps) {
  const { icon: Icon, box, iconColor } = TONES[tone];

  return (
    <div className={`flex gap-3 rounded-control border p-3 text-[13px] ${box}`}>
      <Icon aria-hidden className={`mt-0.5 size-4 shrink-0 ${iconColor}`} />
      <div className="min-w-0 text-ink-muted">
        {title ? <p className="font-semibold text-ink">{title}</p> : null}
        {children}
      </div>
    </div>
  );
}

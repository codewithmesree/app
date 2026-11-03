import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-primary-soft text-primary-hover">
        <Icon aria-hidden className="size-5" />
      </span>
      <div className="max-w-sm">
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm text-ink-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}

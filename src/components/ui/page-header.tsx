import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description: string;
  eyebrow?: string;
  aside?: ReactNode;
};

export function PageHeader({ title, description, eyebrow, aside }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 max-w-2xl">
        {eyebrow ? <p className="label-mono mb-2 text-lavender">{eyebrow}</p> : null}
        <h1 className="text-[26px] font-semibold tracking-tight sm:text-[32px] sm:leading-10">{title}</h1>
        <p className="mt-1 text-ink-muted">{description}</p>
      </div>
      {aside}
    </header>
  );
}

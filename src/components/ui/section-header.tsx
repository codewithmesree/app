import type { ReactNode } from "react";

type SectionHeaderProps = {
  id?: string;
  title: string;
  aside?: ReactNode;
};

export function SectionHeader({ id, title, aside }: SectionHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id={id} className="text-lg font-semibold tracking-tight">
        {title}
      </h2>
      {aside}
    </div>
  );
}

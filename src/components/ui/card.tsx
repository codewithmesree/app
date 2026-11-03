import type { ComponentProps } from "react";

export function Card({ className = "", ...props }: ComponentProps<"section">) {
  return (
    <section
      className={`rounded-card border border-line bg-surface p-4 shadow-card sm:p-6 ${className}`}
      {...props}
    />
  );
}

import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import type { ComponentProps } from "react";

type ButtonVariant = "primary" | "accent" | "secondary" | "ghost";

const BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-4 py-2 text-sm font-semibold transition duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary-solid text-white shadow-button hover:bg-primary-solid-hover",
  accent: "bg-lavender text-on-lavender shadow-button hover:bg-lavender-hover",
  secondary: "border border-line bg-surface-muted text-ink hover:border-primary hover:bg-primary-soft",
  ghost: "text-ink-muted hover:bg-surface-muted hover:text-ink",
};

type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  /** Blocks repeat submissions while a request is in flight. */
  loading?: boolean;
};

export function Button({
  variant = "primary",
  loading = false,
  disabled,
  className = "",
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${BASE} ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {loading ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: ButtonVariant };

export function ButtonLink({ variant = "primary", className = "", ...props }: ButtonLinkProps) {
  return <Link className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props} />;
}

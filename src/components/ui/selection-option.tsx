import { Check } from "lucide-react";
import type { ReactNode } from "react";

type SelectionOptionProps = {
  type: "radio" | "checkbox";
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  leading: ReactNode;
  title: ReactNode;
  description: ReactNode;
  trailing?: ReactNode;
};

/** A native radio or checkbox dressed as a row, so keyboard and screen reader behaviour come for free. */
export function SelectionOption({ type, name, value, checked, onChange, leading, title, description, trailing }: SelectionOptionProps) {
  return (
    <label
      className={`relative flex min-h-[68px] cursor-pointer items-center gap-3 rounded-2xl border p-3 transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary-hover sm:gap-4 ${
        checked ? "border-lavender/70 bg-surface-raised" : "border-transparent bg-surface hover:border-line"
      }`}
    >
      <input type={type} name={name} value={value} checked={checked} onChange={onChange} className="sr-only" />
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-ink">{title}</span>
        <span className="block font-mono text-[13px] text-ink-muted">{description}</span>
      </span>
      {trailing}
      <span
        aria-hidden
        className={`grid size-6 shrink-0 place-items-center border transition-colors duration-150 ${
          type === "radio" ? "rounded-full" : "rounded-md"
        } ${checked ? "border-lavender bg-lavender text-on-lavender" : "border-line bg-surface-muted"}`}
      >
        {checked ? <Check strokeWidth={3} className="size-3.5" /> : null}
      </span>
    </label>
  );
}

import { Search } from "lucide-react";
import { useId } from "react";

type SearchFieldProps = {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
};

export function SearchField({ label, placeholder, value, onChange }: SearchFieldProps) {
  const id = useId();

  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-ink-subtle" />
      <input
        id={id}
        type="search"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-12 w-full rounded-control border border-line bg-surface pl-11 pr-3 text-ink transition-colors duration-150 placeholder:text-ink-subtle hover:border-ink-subtle focus:border-primary-hover"
      />
    </div>
  );
}

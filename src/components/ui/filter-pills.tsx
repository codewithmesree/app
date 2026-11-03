type FilterPillsProps<T extends string> = {
  label: string;
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

export function FilterPills<T extends string>({ label, options, value, onChange }: FilterPillsProps<T>) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.id)}
            className={`min-h-10 rounded-full border px-4 font-mono text-[13px] transition-colors duration-150 ${
              active
                ? "border-lavender bg-lavender font-medium text-on-lavender"
                : "border-line bg-surface text-ink-muted hover:border-ink-subtle hover:text-ink"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

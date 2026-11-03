type ResultCountProps = {
  count: number;
  noun: string;
  emptyMessage: string;
};

/** Announces filter results and explains an empty list. */
export function ResultCount({ count, noun, emptyMessage }: ResultCountProps) {
  return (
    <p role="status" className={count === 0 ? "rounded-2xl border border-dashed border-line p-6 text-center text-sm text-ink-muted" : "sr-only"}>
      {count === 0 ? emptyMessage : `${count} ${noun}${count === 1 ? "" : "s"} shown`}
    </p>
  );
}

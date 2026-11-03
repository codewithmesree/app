import { Eye } from "lucide-react";
import Link from "next/link";
import { PREVIEW_STATES, type PreviewState } from "@/features/dashboard/sample-data";

/** Labels the fixtures as sample data and lets reviewers open each UI state. */
export function SampleDataNotice({ current }: { current: PreviewState }) {
  return (
    <aside
      aria-label="Prototype data"
      className="flex flex-col gap-3 rounded-control border border-dashed border-line px-3 py-3 text-[13px] md:flex-row md:items-center md:justify-between"
    >
      <p className="flex gap-2 text-ink-muted">
        <Eye aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          <span className="font-semibold text-ink">Prototype with sample data.</span> Merchants, rates and activity
          below are fictional.
        </span>
      </p>
      <nav aria-label="Preview dashboard state">
        <ul className="flex flex-wrap gap-1">
          {PREVIEW_STATES.map(({ id, label }) => {
            const active = id === current;
            return (
              <li key={id}>
                <Link
                  href={id === "sample" ? "/dashboard" : `/dashboard?preview=${id}`}
                  scroll={false}
                  aria-current={active ? "true" : undefined}
                  className={`inline-flex min-h-9 items-center whitespace-nowrap rounded-full border px-3 font-medium transition-colors duration-150 ${
                    active
                      ? "border-primary bg-primary-soft text-ink"
                      : "border-transparent text-ink-muted hover:bg-surface-muted hover:text-ink"
                  }`}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

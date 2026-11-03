import { Bot, ChevronRight, Store, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { SectionHeader } from "@/components/ui/section-header";

const LINKS: { href: string; title: string; description: string; icon: LucideIcon }[] = [
  // Mobile navigation has no Merchants tab, so this stays the route there.
  {
    href: "/merchants",
    title: "Demo merchants",
    description: "See sample merchants and what each one supports.",
    icon: Store,
  },
  {
    href: "/assistant",
    title: "AI Assistant",
    description: "Ask what a rate or payment status means. It can’t approve payments.",
    icon: Bot,
  },
];

export function QuickLinks() {
  return (
    <section aria-labelledby="quick-links-heading" className="flex flex-col gap-4">
      <SectionHeader id="quick-links-heading" title="Quick links" />
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {LINKS.map(({ href, title, description, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="group flex h-full items-center gap-3 rounded-card border border-line bg-surface p-4 transition-colors duration-150 hover:border-primary hover:bg-surface-raised"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-control bg-primary-soft text-primary-hover">
                <Icon aria-hidden className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{title}</span>
                <span className="block text-[13px] text-ink-muted">{description}</span>
              </span>
              <ChevronRight
                aria-hidden
                className="size-4 shrink-0 text-ink-subtle transition-transform duration-150 group-hover:translate-x-0.5"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

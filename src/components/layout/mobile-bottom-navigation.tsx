"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActiveItem, MOBILE_NAV_ITEMS } from "./nav-items";

export function MobileBottomNavigation() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[var(--gp-safe-bottom)] lg:hidden"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-4">
        {MOBILE_NAV_ITEMS.map((item) => {
          const { href, label, icon: Icon } = item;
          const active = isActiveItem(pathname, item);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 font-mono text-[11px] uppercase tracking-[0.08em] ${
                  active ? "font-semibold text-lavender" : "font-medium text-ink-muted"
                }`}
              >
                <span className="relative grid h-7 w-14 place-items-center">
                  {active ? (
                    <motion.span
                      layoutId="mobile-active"
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="absolute inset-0 rounded-full bg-primary-soft"
                    />
                  ) : null}
                  <Icon aria-hidden className="relative size-5" />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

"use client";

import { Settings } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SandboxBadge } from "@/components/payment/sandbox-badge";
import { Logo } from "./logo";
import { isActiveItem, NAV_ITEMS } from "./nav-items";

export function TopBar() {
  const pathname = usePathname();
  const settingsActive = pathname === "/settings";

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-canvas">
      <div className="mx-auto flex min-h-16 max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-6">
          <Logo />
          <nav aria-label="Main" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const active = isActiveItem(pathname, item);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`relative flex min-h-10 items-center rounded-control px-3 text-sm transition-colors duration-150 ${
                        active ? "font-semibold text-ink" : "font-medium text-ink-muted hover:text-ink"
                      }`}
                    >
                      {active ? (
                        <motion.span
                          layoutId="top-nav-active"
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          className="absolute inset-0 rounded-control border-b-2 border-lavender bg-surface-muted"
                        />
                      ) : null}
                      <span className="relative">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <SandboxBadge />
          <Link
            href="/settings"
            aria-label="Settings"
            aria-current={settingsActive ? "page" : undefined}
            className={`grid size-11 place-items-center rounded-control transition-colors duration-150 hover:bg-surface-muted hover:text-ink ${
              settingsActive ? "bg-surface-muted text-lavender" : "text-ink-muted"
            }`}
          >
            <Settings aria-hidden className="size-5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

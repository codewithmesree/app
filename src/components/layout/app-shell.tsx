import type { ReactNode } from "react";
import { MobileBottomNavigation } from "./mobile-bottom-navigation";
import { TopBar } from "./top-bar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="fixed left-4 top-3 z-30 -translate-y-20 rounded-control bg-surface-raised px-4 py-2 text-sm font-semibold focus:translate-y-0"
      >
        Skip to content
      </a>
      <TopBar />
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-[1200px] flex-1 px-4 pb-[calc(6.5rem+var(--gp-safe-bottom))] pt-6 outline-none sm:px-6 lg:px-8 lg:pb-12 lg:pt-10"
      >
        {children}
      </main>
      <MobileBottomNavigation />
    </div>
  );
}

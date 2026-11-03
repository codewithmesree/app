import { ArrowLeftRight, Banknote, ReceiptText, ScanLine, Sparkles, Store, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  /** Other routes that keep this item highlighted. */
  matches?: string[];
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: Banknote },
  { href: "/pay", label: "Pay", matches: ["/scan", "/connect-bank"], icon: ScanLine },
  { href: "/rates", label: "Rates", icon: ArrowLeftRight },
  { href: "/merchants", label: "Merchants", icon: Store },
  { href: "/assistant", label: "Assistant", icon: Sparkles },
  { href: "/transactions", label: "History", icon: ReceiptText },
];

/** The mobile bar treats the dashboard and its payment actions as one "Pay" area. */
export const MOBILE_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Pay", matches: ["/pay", "/scan"], icon: Banknote },
  { href: "/rates", label: "Rates", icon: ArrowLeftRight },
  { href: "/assistant", label: "Assistant", icon: Sparkles },
  { href: "/transactions", label: "History", icon: ReceiptText },
];

export function isActiveItem(pathname: string, { href, matches = [] }: NavItem): boolean {
  return [href, ...matches].some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

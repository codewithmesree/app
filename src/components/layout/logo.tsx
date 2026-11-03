import Link from "next/link";

export function Logo() {
  return (
    <Link href="/dashboard" aria-label="GlobalPay dashboard" className="inline-flex items-center gap-2.5 rounded-control">
      <svg aria-hidden viewBox="0 0 32 32" fill="none" className="size-8 shrink-0">
        <rect width="32" height="32" rx="9" fill="var(--gp-primary-solid)" />
        <circle cx="16" cy="16" r="8.5" stroke="var(--gp-text)" strokeWidth="2" />
        <path
          d="M16 7.5c-5 4.8-5 12.2 0 17M7.5 16H19m0 0-3.2-3.2M19 16l-3.2 3.2"
          stroke="var(--gp-text)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="hidden text-[17px] font-semibold tracking-tight min-[360px]:inline">GlobalPay</span>
    </Link>
  );
}

import type { ReactNode } from "react";
import type { CountryCode } from "@/features/travel/countries";

/** Simplified inline flags: emoji flags don't render on Windows. Decorative; the name is always shown beside them. */
const FLAGS: Record<CountryCode, ReactNode> = {
  GB: (
    <>
      <rect width="30" height="20" fill="#012169" />
      <path d="M0 0 30 20M30 0 0 20" stroke="#fff" strokeWidth="4" />
      <path d="M0 0 30 20M30 0 0 20" stroke="#c8102e" strokeWidth="1.6" />
      <path d="M15 0v20M0 10h30" stroke="#fff" strokeWidth="6.5" />
      <path d="M15 0v20M0 10h30" stroke="#c8102e" strokeWidth="3.8" />
    </>
  ),
  US: (
    <>
      <rect width="30" height="20" fill="#fff" />
      {[0, 3.08, 6.15, 9.23, 12.31, 15.38, 18.46].map((y) => (
        <rect key={y} y={y} width="30" height="1.54" fill="#b22234" />
      ))}
      <rect width="13" height="10.8" fill="#3c3b6e" />
    </>
  ),
  JP: (
    <>
      <rect width="30" height="20" fill="#fff" />
      <circle cx="15" cy="10" r="6" fill="#bc002d" />
    </>
  ),
  FR: (
    <>
      <rect width="10" height="20" fill="#0055a4" />
      <rect x="10" width="10" height="20" fill="#fff" />
      <rect x="20" width="10" height="20" fill="#ef4135" />
    </>
  ),
  SG: (
    <>
      <rect width="30" height="10" fill="#ee2536" />
      <rect y="10" width="30" height="10" fill="#fff" />
      <circle cx="7" cy="5" r="3.4" fill="#fff" />
      <circle cx="8.4" cy="5" r="3.2" fill="#ee2536" />
    </>
  ),
  AE: (
    <>
      <rect width="30" height="6.67" fill="#00732f" />
      <rect y="6.67" width="30" height="6.67" fill="#fff" />
      <rect y="13.33" width="30" height="6.67" fill="#000" />
      <rect width="8" height="20" fill="#ff0000" />
    </>
  ),
  TH: (
    <>
      <rect width="30" height="20" fill="#a51931" />
      <rect y="3.33" width="30" height="13.33" fill="#f4f5f8" />
      <rect y="6.67" width="30" height="6.67" fill="#2d2a4a" />
    </>
  ),
  CH: (
    <>
      <rect width="30" height="20" fill="#d52b1e" />
      <path d="M12.5 4h5v3.5H21v5h-3.5V16h-5v-3.5H9v-5h3.5z" fill="#fff" />
    </>
  ),
  DE: (
    <>
      <rect width="30" height="6.67" fill="#000" />
      <rect y="6.67" width="30" height="6.67" fill="#dd0000" />
      <rect y="13.33" width="30" height="6.67" fill="#ffce00" />
    </>
  ),
  AU: (
    <>
      <rect width="30" height="20" fill="#00247d" />
      <path d="M0 0 13 9M13 0 0 9" stroke="#fff" strokeWidth="1.6" />
      <path d="M6.5 0v9M0 4.5h13" stroke="#fff" strokeWidth="3" />
      <path d="M6.5 0v9M0 4.5h13" stroke="#cf142b" strokeWidth="1.6" />
      <circle cx="6.5" cy="14.5" r="1.8" fill="#fff" />
      {[
        [23, 3.5],
        [19, 9],
        [26, 8],
        [23, 16],
      ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1" fill="#fff" />
      ))}
    </>
  ),
  IN: (
    <>
      <rect width="30" height="6.67" fill="#ff9933" />
      <rect y="6.67" width="30" height="6.67" fill="#fff" />
      <rect y="13.33" width="30" height="6.67" fill="#138808" />
      <circle cx="15" cy="10" r="2.4" fill="none" stroke="#000080" strokeWidth="0.8" />
    </>
  ),
  CA: (
    <>
      <rect width="30" height="20" fill="#fff" />
      <rect width="7.5" height="20" fill="#d80621" />
      <rect x="22.5" width="7.5" height="20" fill="#d80621" />
      <path d="m15 4 1.3 2.6 1.7-.7-.7 3.6 2.2-1.9.5 1.5 2-.3-.7 2 .9.5-3.4 2.7.4 1.3-3.6-.5V16h-1.2v-1.8l-3.6.5.4-1.3-3.4-2.7.9-.5-.7-2 2 .3.5-1.5 2.2 1.9-.7-3.6 1.7.7z" fill="#d80621" />
    </>
  ),
};

export function CountryFlag({ code, className = "" }: { code: CountryCode; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 30 20" className={`h-4 w-6 shrink-0 rounded-[3px] ${className}`}>
      {FLAGS[code]}
    </svg>
  );
}

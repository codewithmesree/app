import { formatDecimal } from "@/lib/format-money";

type MoneyAmountProps = {
  amount: string;
  currency: string;
  className?: string;
};

/** Always pairs the value with its ISO code; never relies on a symbol alone. */
export function MoneyAmount({ amount, currency, className = "" }: MoneyAmountProps) {
  return (
    <span className={`tabular whitespace-nowrap ${className}`}>
      {formatDecimal(amount)} <span className="text-[0.72em] font-medium text-ink-muted">{currency}</span>
    </span>
  );
}

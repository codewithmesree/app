import { MerchantCategoryIcon } from "@/components/merchants/merchant-category-icon";
import { PaymentStatusBadge } from "@/components/payment/payment-status-badge";
import { MoneyAmount } from "@/components/ui/money-amount";
import type { TransactionSummary } from "@/features/payment/payment-types";
import { formatDateTimeUtc } from "@/lib/format-date";

export function TransactionListItem({ transaction }: { transaction: TransactionSummary }) {
  const { merchant, amount, currency, status, createdAt } = transaction;

  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 py-4 first:pt-0 last:pb-0 sm:gap-x-4">
      {merchant.category ? (
        <span className="grid size-11 place-items-center rounded-control bg-surface-muted text-ink-muted">
          <MerchantCategoryIcon category={merchant.category} className="size-5" />
        </span>
      ) : (
        <span aria-hidden className="size-11 rounded-control bg-surface-muted" />
      )}
      <div className="min-w-0">
        <p className="font-medium [overflow-wrap:anywhere]">{merchant.name}</p>
        <time dateTime={createdAt} className="block text-[13px] text-ink-subtle">
          {formatDateTimeUtc(createdAt)}
        </time>
      </div>
      <div className="flex flex-col items-end gap-2">
        <MoneyAmount amount={amount} currency={currency} className="font-mono font-medium" />
        <span className="hidden sm:block">
          <PaymentStatusBadge status={status} />
        </span>
      </div>
      <div className="col-span-3 sm:hidden">
        <PaymentStatusBadge status={status} />
      </div>
    </li>
  );
}

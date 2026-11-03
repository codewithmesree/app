import {
  CircleCheck,
  CircleDashed,
  CircleHelp,
  CircleMinus,
  CircleX,
  Clock,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PAYMENT_STATUS } from "@/features/payment/payment-status";
import type { TransactionStatus } from "@/features/payment/payment-types";

const ICONS: Record<TransactionStatus, LucideIcon> = {
  CREATED: CircleDashed,
  AWAITING_APPROVAL: Clock,
  CAPTURE_PENDING: RefreshCw,
  COMPLETED: CircleCheck,
  CANCELLED: CircleMinus,
  FAILED: CircleX,
  STATUS_UNKNOWN: CircleHelp,
};

export function PaymentStatusBadge({ status }: { status: TransactionStatus }) {
  const { label, tone } = PAYMENT_STATUS[status];
  const Icon = ICONS[status];

  return (
    <Badge tone={tone} icon={<Icon aria-hidden className="size-3.5 shrink-0" />}>
      {label}
    </Badge>
  );
}

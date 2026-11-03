import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Landmark,
  LoaderCircle,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  BANK_STATUS_CONFIG,
  type BankLinkingStatus,
  type BankStatusTone,
} from "@/features/bank-linking/bank-linking-types";

const ICONS: Record<BankLinkingStatus, LucideIcon> = {
  not_linked: Landmark,
  linking_in_progress: LoaderCircle,
  linked: CheckCircle2,
  linking_failed: AlertCircle,
  connection_expired: Clock,
  reconnection_required: ShieldAlert,
};

type BankLinkingBadgeProps = {
  status: BankLinkingStatus;
  className?: string;
  showIcon?: boolean;
};

export function BankLinkingBadge({ status, showIcon = true }: BankLinkingBadgeProps) {
  const meta = BANK_STATUS_CONFIG[status];
  const Icon = ICONS[status];
  const tone: BankStatusTone = meta.tone;

  return (
    <Badge
      tone={tone}
      icon={
        showIcon ? (
          <Icon
            aria-hidden
            className={`size-3.5 shrink-0 ${status === "linking_in_progress" ? "animate-spin" : ""}`}
          />
        ) : null
      }
    >
      {meta.label}
    </Badge>
  );
}


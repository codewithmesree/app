import { FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function SandboxBadge() {
  return (
    <Badge tone="warning" icon={<FlaskConical aria-hidden className="size-3.5" />}>
      <span className="whitespace-nowrap">PayPal Sandbox</span>
    </Badge>
  );
}

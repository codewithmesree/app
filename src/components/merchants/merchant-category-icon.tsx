import { BedDouble, ShoppingBag, TrainFront, UtensilsCrossed, type LucideIcon } from "lucide-react";
import type { MerchantCategory } from "@/features/merchants/merchant-types";

const ICONS: Record<MerchantCategory, LucideIcon> = {
  hotel: BedDouble,
  dining: UtensilsCrossed,
  transit: TrainFront,
  retail: ShoppingBag,
};

export function MerchantCategoryIcon({ category, className }: { category: MerchantCategory; className?: string }) {
  const Icon = ICONS[category];
  return <Icon aria-hidden className={className} />;
}

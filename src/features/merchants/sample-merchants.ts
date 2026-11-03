import { getCountry, type CountryCode } from "@/features/travel/countries";
import type { MerchantCategory } from "./merchant-types";

/** MOCK DATA: placeholder names only. Replace with GET /api/merchants. */
const SAMPLE_CATEGORIES: { category: MerchantCategory; label: string }[] = [
  { category: "hotel", label: "Hotel" },
  { category: "dining", label: "Dining" },
  { category: "transit", label: "Transit" },
];

export function getSampleMerchants(country: CountryCode) {
  const { name } = getCountry(country);
  return SAMPLE_CATEGORIES.map(({ category, label }) => ({
    id: `sample-${country}-${category}`,
    name: `Sample ${label.toLowerCase()} merchant`,
    place: name,
    category,
    label,
  }));
}

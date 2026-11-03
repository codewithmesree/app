import type { CurrencyCode } from "@/features/currency/currencies";

export type CountryRegion = "asia-pacific" | "europe" | "middle-east" | "americas";

/** Demonstration countries for the prototype; listing one implies no payment support there. */
export const COUNTRIES = [
  { code: "GB", name: "United Kingdom", currency: "GBP", region: "europe", popular: true },
  { code: "US", name: "United States", currency: "USD", region: "americas", popular: true },
  { code: "JP", name: "Japan", currency: "JPY", region: "asia-pacific", popular: true },
  { code: "FR", name: "France", currency: "EUR", region: "europe", popular: true },
  { code: "SG", name: "Singapore", currency: "SGD", region: "asia-pacific", popular: true },
  { code: "AE", name: "United Arab Emirates", currency: "AED", region: "middle-east", popular: true },
  { code: "TH", name: "Thailand", currency: "THB", region: "asia-pacific", popular: true },
  { code: "CH", name: "Switzerland", currency: "CHF", region: "europe", popular: true },
  { code: "DE", name: "Germany", currency: "EUR", region: "europe", popular: false },
  { code: "AU", name: "Australia", currency: "AUD", region: "asia-pacific", popular: false },
  { code: "IN", name: "India", currency: "INR", region: "asia-pacific", popular: false },
  { code: "CA", name: "Canada", currency: "CAD", region: "americas", popular: false },
] as const satisfies readonly {
  code: string;
  name: string;
  currency: CurrencyCode;
  region: CountryRegion;
  popular: boolean;
}[];

export type Country = (typeof COUNTRIES)[number];
export type CountryCode = Country["code"];

export const REGION_FILTERS = [
  { id: "popular", label: "Popular" },
  { id: "asia-pacific", label: "Asia-Pacific" },
  { id: "europe", label: "Europe" },
  { id: "middle-east", label: "Middle East" },
  { id: "americas", label: "Americas" },
] as const;

export type RegionFilter = (typeof REGION_FILTERS)[number]["id"];

export function getCountry(code: CountryCode): Country {
  return COUNTRIES.find((country) => country.code === code)!;
}

export function findCountries(query: string, filter?: RegionFilter): Country[] {
  const needle = query.trim().toLowerCase();

  return COUNTRIES.filter((country) => {
    // A search spans every region so a match is never hidden by the active tab.
    if (!needle) {
      if (filter === "popular") return country.popular;
      if (filter) return country.region === filter;
      return true;
    }
    return [country.name, country.code, country.currency].some((field) => field.toLowerCase().includes(needle));
  });
}

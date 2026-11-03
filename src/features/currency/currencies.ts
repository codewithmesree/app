export type CurrencyRegion = "americas" | "apac" | "emea";

export const CURRENCIES = [
  { code: "USD", name: "United States Dollar", symbol: "$", area: "United States", areaCode: "US", decimals: 2, region: "americas", g10: true },
  { code: "EUR", name: "Euro", symbol: "€", area: "Eurozone", areaCode: "EU", decimals: 2, region: "emea", g10: true },
  { code: "GBP", name: "British Pound Sterling", symbol: "£", area: "United Kingdom", areaCode: "UK", decimals: 2, region: "emea", g10: true },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", area: "Japan", areaCode: "JP", decimals: 0, region: "apac", g10: true },
  { code: "CHF", name: "Swiss Franc", symbol: "Fr", area: "Switzerland", areaCode: "CH", decimals: 2, region: "emea", g10: true },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", area: "Australia", areaCode: "AU", decimals: 2, region: "apac", g10: true },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$", area: "Canada", areaCode: "CA", decimals: 2, region: "americas", g10: true },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", area: "Singapore", areaCode: "SG", decimals: 2, region: "apac", g10: false },
  { code: "AED", name: "UAE Dirham", symbol: "Dh", area: "United Arab Emirates", areaCode: "AE", decimals: 2, region: "emea", g10: false },
  { code: "THB", name: "Thai Baht", symbol: "฿", area: "Thailand", areaCode: "TH", decimals: 2, region: "apac", g10: false },
  { code: "INR", name: "Indian Rupee", symbol: "₹", area: "India", areaCode: "IN", decimals: 2, region: "apac", g10: false },
] as const satisfies readonly {
  code: string;
  name: string;
  symbol: string;
  area: string;
  areaCode: string;
  decimals: number;
  region: CurrencyRegion;
  g10: boolean;
}[];

export type Currency = (typeof CURRENCIES)[number];
export type CurrencyCode = Currency["code"];

export const CURRENCY_FILTERS = [
  { id: "all", label: "All" },
  { id: "g10", label: "G10 major" },
  { id: "apac-emea", label: "APAC / EMEA" },
] as const;

export type CurrencyFilter = (typeof CURRENCY_FILTERS)[number]["id"];

export function getCurrency(code: CurrencyCode): Currency {
  return CURRENCIES.find((currency) => currency.code === code)!;
}

export function findCurrencies(query: string, filter: CurrencyFilter): Currency[] {
  const needle = query.trim().toLowerCase();

  return CURRENCIES.filter((currency) => {
    if (filter === "g10" && !currency.g10) return false;
    if (filter === "apac-emea" && currency.region === "americas") return false;
    return [currency.code, currency.name, currency.area, currency.areaCode, currency.symbol].some((field) =>
      field.toLowerCase().includes(needle),
    );
  });
}

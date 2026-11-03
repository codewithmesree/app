import type { Metadata } from "next";
import { RatesListClient } from "@/components/currency/rates-list-client";

export const metadata: Metadata = {
  title: "Rates",
  description: "Indicative exchange rates for international currencies and travel corridors.",
};

export default function RatesPage() {
  return <RatesListClient />;
}

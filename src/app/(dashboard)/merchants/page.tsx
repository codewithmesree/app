import type { Metadata } from "next";
import { MerchantsListClient } from "@/components/merchants/merchants-list-client";

export const metadata: Metadata = {
  title: "Merchants",
  description: "Explore supported merchants in your destination travel corridors.",
};

export default function MerchantsPage() {
  return <MerchantsListClient />;
}

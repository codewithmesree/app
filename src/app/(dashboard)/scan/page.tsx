import type { Metadata } from "next";
import { ScanPageClient } from "@/components/payment/scan-page-client";

export const metadata: Metadata = {
  title: "Scan QR",
  description: "Scan a GlobalPay demo QR code. Bank linking required to initiate payment.",
};

export default function ScanPage() {
  return <ScanPageClient />;
}

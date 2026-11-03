import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { MotionProvider } from "@/components/motion/motion-provider";
import { BankLinkingProvider } from "@/features/bank-linking/bank-linking-context";
import { TravellerPreferencesProvider } from "@/features/travel/traveller-preferences";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "GlobalPay",
    template: "%s · GlobalPay",
  },
  description:
    "AI-assisted international travel payment prototype. Payments use PayPal Sandbox; no real money moves.",
};

export const viewport: Viewport = {
  themeColor: "#09090F",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${jetBrainsMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <MotionProvider>
          <BankLinkingProvider>
            <TravellerPreferencesProvider>{children}</TravellerPreferencesProvider>
          </BankLinkingProvider>
        </MotionProvider>
      </body>
    </html>
  );
}

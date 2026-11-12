import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { MotionProvider } from "@/components/motion/motion-provider";
import { BankLinkingProvider } from "@/features/bank-linking/bank-linking-context";
import { SessionProvider } from "@/features/session/session-provider";
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
  applicationName: "GlobalPay",
  description:
    "International travel payment prototype with indicative exchange estimates and PayPal Sandbox. No real money moves.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/globalpay-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/globalpay-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "GlobalPay",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#09090F",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${jetBrainsMono.variable} h-full antialiased`}>
      <body className="min-h-full" suppressHydrationWarning>
        <MotionProvider>
          <SessionProvider>
            <BankLinkingProvider>
              <TravellerPreferencesProvider>{children}</TravellerPreferencesProvider>
            </BankLinkingProvider>
          </SessionProvider>
        </MotionProvider>
      </body>
    </html>
  );
}

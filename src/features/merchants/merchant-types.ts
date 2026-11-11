export type MerchantCategory = "hotel" | "dining" | "transit" | "retail";

export type MerchantCatalogueItem = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string | null;
  countryCode: string | null;
  displayCurrency: string;
  supportedMethods: string[];
  isDemo: boolean;
  demoAmount?: string | null;
  demoQrIdentifier?: string | null;
  isActive?: boolean;
};

// =============================================================================
// GlobalPay — Merchant Catalogue & Discovery Service
// =============================================================================
// PRD §17.1, api-contract.md §5, database-schema.md §4.2:
// Server-only data access for demo merchant catalogue and discovery.
// =============================================================================

import "server-only";
import { type Merchant, type Prisma } from "@prisma/client";
import { db } from "../db";
import { ApiError } from "../errors/api-error";
import { logger } from "../logging/logger";
import { type MerchantListQuery } from "../validation/merchants";

export interface SafeMerchantSummary {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string | null;
  countryCode: string | null;
  displayCurrency: string;
  supportedMethods: string[];
  isDemo: boolean;
}

export interface SafeMerchantDetail extends SafeMerchantSummary {
  demoQrIdentifier: string | null;
  isActive: boolean;
}

export interface MerchantListResult {
  items: SafeMerchantSummary[];
  nextCursor: string | null;
}

/**
 * Curated list of demo merchants spanning primary travel corridors.
 */
export const DEMO_MERCHANTS_SEED_DATA = [
  {
    slug: "tokyo-metro-transit",
    name: "Tokyo Metro Pass Kiosk",
    category: "transit",
    description: "Automated ticket kiosk for Tokyo underground transit network.",
    countryCode: "JP",
    displayCurrency: "JPY",
    supportedMethods: ["PAYPAL_SANDBOX"],
    demoQrIdentifier: "qr_demo_jp_metro_01",
    isDemo: true,
    isActive: true,
  },
  {
    slug: "shinjuku-izakaya-dining",
    name: "Omoide Yokocho Yakitori",
    category: "dining",
    description: "Traditional casual dining skewers stall in Shinjuku.",
    countryCode: "JP",
    displayCurrency: "JPY",
    supportedMethods: ["PAYPAL_SANDBOX"],
    demoQrIdentifier: "qr_demo_jp_dining_01",
    isDemo: true,
    isActive: true,
  },
  {
    slug: "kyoto-ryokan-stay",
    name: "Gion Heritage Ryokan",
    category: "hotel",
    description: "Boutique traditional Japanese inn in historic Kyoto district.",
    countryCode: "JP",
    displayCurrency: "JPY",
    supportedMethods: ["PAYPAL_SANDBOX"],
    demoQrIdentifier: "qr_demo_jp_hotel_01",
    isDemo: true,
    isActive: true,
  },
  {
    slug: "london-underground-tfl",
    name: "TfL Travel Card Terminal",
    category: "transit",
    description: "Transport for London contactless fare and travelcard point.",
    countryCode: "GB",
    displayCurrency: "GBP",
    supportedMethods: ["PAYPAL_SANDBOX"],
    demoQrIdentifier: "qr_demo_gb_tfl_01",
    isDemo: true,
    isActive: true,
  },
  {
    slug: "borough-market-bakery",
    name: "St. John Bakery Borough",
    category: "dining",
    description: "Artisan sourdough and pastry counter at Borough Market.",
    countryCode: "GB",
    displayCurrency: "GBP",
    supportedMethods: ["PAYPAL_SANDBOX"],
    demoQrIdentifier: "qr_demo_gb_bakery_01",
    isDemo: true,
    isActive: true,
  },
  {
    slug: "covent-garden-boutique",
    name: "Seven Dials Luggage & Goods",
    category: "retail",
    description: "Travel accessories and leather goods in Covent Garden.",
    countryCode: "GB",
    displayCurrency: "GBP",
    supportedMethods: ["PAYPAL_SANDBOX"],
    demoQrIdentifier: "qr_demo_gb_retail_01",
    isDemo: true,
    isActive: true,
  },
  {
    slug: "paris-metro-ratp",
    name: "RATP Ticket Pass Automate",
    category: "transit",
    description: "Paris Île-de-France transit pass ticket vending kiosk.",
    countryCode: "FR",
    displayCurrency: "EUR",
    supportedMethods: ["PAYPAL_SANDBOX"],
    demoQrIdentifier: "qr_demo_fr_ratp_01",
    isDemo: true,
    isActive: true,
  },
  {
    slug: "bistrot-paul-bert",
    name: "Bistrot Paul Bert Paris",
    category: "dining",
    description: "Classic Parisian neighborhood bistro serving regional fare.",
    countryCode: "FR",
    displayCurrency: "EUR",
    supportedMethods: ["PAYPAL_SANDBOX"],
    demoQrIdentifier: "qr_demo_fr_dining_01",
    isDemo: true,
    isActive: true,
  },
  {
    slug: "le-marais-hotel",
    name: "Hôtel de Ville Marais",
    category: "hotel",
    description: "Independent boutique hotel located in the 4th arrondissement.",
    countryCode: "FR",
    displayCurrency: "EUR",
    supportedMethods: ["PAYPAL_SANDBOX"],
    demoQrIdentifier: "qr_demo_fr_hotel_01",
    isDemo: true,
    isActive: true,
  },
  {
    slug: "singapore-smrt",
    name: "SMRT Transit Changi Hub",
    category: "transit",
    description: "MRT transit terminal service counter at Changi Airport.",
    countryCode: "SG",
    displayCurrency: "SGD",
    supportedMethods: ["PAYPAL_SANDBOX"],
    demoQrIdentifier: "qr_demo_sg_transit_01",
    isDemo: true,
    isActive: true,
  },
  {
    slug: "maxwell-food-centre",
    name: "Tian Tian Hainanese Chicken",
    category: "dining",
    description: "Renowned hawker stall at Maxwell Food Centre.",
    countryCode: "SG",
    displayCurrency: "SGD",
    supportedMethods: ["PAYPAL_SANDBOX"],
    demoQrIdentifier: "qr_demo_sg_dining_01",
    isDemo: true,
    isActive: true,
  },
  {
    slug: "mbs-retail-promenade",
    name: "Marina Bay Sands Galleria",
    category: "retail",
    description: "Duty-free luxury travel and souvenir storefront.",
    countryCode: "SG",
    displayCurrency: "SGD",
    supportedMethods: ["PAYPAL_SANDBOX"],
    demoQrIdentifier: "qr_demo_sg_retail_01",
    isDemo: true,
    isActive: true,
  },
  {
    slug: "nyc-mta-omny",
    name: "MTA OMNY Fare Vending",
    category: "transit",
    description: "New York City Subway contactless fare dispenser.",
    countryCode: "US",
    displayCurrency: "USD",
    supportedMethods: ["PAYPAL_SANDBOX"],
    demoQrIdentifier: "qr_demo_us_mta_01",
    isDemo: true,
    isActive: true,
  },
  {
    slug: "chelsea-market-bites",
    name: "Chelsea Lobster & Chowder",
    category: "dining",
    description: "Seafood eatery within the Chelsea Market concourse.",
    countryCode: "US",
    displayCurrency: "USD",
    supportedMethods: ["PAYPAL_SANDBOX"],
    demoQrIdentifier: "qr_demo_us_dining_01",
    isDemo: true,
    isActive: true,
  },
  {
    slug: "grand-central-kiosk",
    name: "Grand Central Travel Press",
    category: "retail",
    description: "Travel essentials and magazines at Grand Central Terminal.",
    countryCode: "US",
    displayCurrency: "USD",
    supportedMethods: ["PAYPAL_SANDBOX"],
    demoQrIdentifier: "qr_demo_us_retail_01",
    isDemo: true,
    isActive: true,
  },
];

/**
 * Parses JSON supported methods safely.
 */
function parseSupportedMethods(methods: Prisma.JsonValue): string[] {
  if (Array.isArray(methods)) {
    return methods.map((m) => String(m));
  }
  if (typeof methods === "string") {
    try {
      const parsed = JSON.parse(methods);
      if (Array.isArray(parsed)) {
        return parsed.map((m) => String(m));
      }
    } catch {
      // Fallback
    }
  }
  return ["PAYPAL_SANDBOX"];
}

/**
 * Formats a Merchant database record into a safe, client-facing summary.
 */
export function formatSafeMerchantSummary(merchant: Merchant): SafeMerchantSummary {
  return {
    id: merchant.id,
    slug: merchant.slug ?? merchant.id,
    name: merchant.name,
    category: merchant.category,
    description: merchant.description,
    countryCode: merchant.countryCode,
    displayCurrency: merchant.displayCurrency,
    supportedMethods: parseSupportedMethods(merchant.supportedMethods),
    isDemo: merchant.isDemo,
  };
}

/**
 * Formats a Merchant database record into a full safe detail representation.
 */
export function formatSafeMerchantDetail(merchant: Merchant): SafeMerchantDetail {
  return {
    ...formatSafeMerchantSummary(merchant),
    demoQrIdentifier: merchant.demoQrIdentifier,
    isActive: merchant.isActive,
  };
}

/**
 * Seeds the database idempotently with curated demo merchants.
 */
export async function seedDemoMerchants(): Promise<number> {
  let count = 0;
  for (const item of DEMO_MERCHANTS_SEED_DATA) {
    await db.merchant.upsert({
      where: { slug: item.slug },
      create: {
        slug: item.slug,
        name: item.name,
        category: item.category,
        description: item.description,
        countryCode: item.countryCode,
        displayCurrency: item.displayCurrency,
        supportedMethods: item.supportedMethods,
        demoQrIdentifier: item.demoQrIdentifier,
        isDemo: item.isDemo,
        isActive: item.isActive,
      },
      update: {
        name: item.name,
        category: item.category,
        description: item.description,
        countryCode: item.countryCode,
        displayCurrency: item.displayCurrency,
        supportedMethods: item.supportedMethods,
        demoQrIdentifier: item.demoQrIdentifier,
        isDemo: item.isDemo,
        isActive: item.isActive,
      },
    });
    count++;
  }

  logger.info("Seeded demo merchants catalogue", { context: { count } });
  return count;
}

/**
 * Queries active merchants with optional filtering and pagination.
 */
export async function listMerchants(
  query: MerchantListQuery
): Promise<MerchantListResult> {
  const where: Prisma.MerchantWhereInput = {
    isActive: true,
  };

  if (query.countryCode) {
    where.countryCode = query.countryCode;
  }

  if (query.category) {
    where.category = query.category;
  }

  if (query.currency) {
    where.displayCurrency = query.currency;
  }

  const take = query.limit + 1; // Fetch one extra to determine nextCursor

  const merchants = await db.merchant.findMany({
    where,
    take,
    cursor: query.cursor ? { id: query.cursor } : undefined,
    skip: query.cursor ? 1 : 0,
    orderBy: [{ countryCode: "asc" }, { name: "asc" }],
  });

  let nextCursor: string | null = null;
  if (merchants.length > query.limit) {
    const nextItem = merchants.pop();
    nextCursor = nextItem?.id ?? null;
  }

  return {
    items: merchants.map(formatSafeMerchantSummary),
    nextCursor,
  };
}

/**
 * Retrieves a single active merchant by ID or slug.
 * Throws ApiError.notFound if missing or inactive.
 */
export async function getMerchantByIdOrSlug(
  identifier: string
): Promise<SafeMerchantDetail> {
  const merchant = await db.merchant.findFirst({
    where: {
      OR: [{ id: identifier }, { slug: identifier }],
      isActive: true,
    },
  });

  if (!merchant) {
    throw ApiError.notFound("The requested merchant was not found.");
  }

  return formatSafeMerchantDetail(merchant);
}


import { PrismaClient } from "@prisma/client";
import { DEMO_MERCHANTS_SEED_DATA } from "../src/lib/merchants/merchant-service";

const db = new PrismaClient();

async function main() {
  console.log("Seeding demo merchants...");
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
  console.log(`Seeded ${count} demo merchants successfully.`);
}

main()
  .catch(() => {
    console.error("Merchant seeding failed. Check DATABASE_URL and confirm migrations have been applied.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });

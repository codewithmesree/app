// =============================================================================
// GlobalPay — Prisma Client Singleton
// =============================================================================
// PRD §7.1, §17.2.1: Server-only database access.
// NEVER import this file from a client component or client-side utility.
// The "server-only" import guarantees Next.js build fails if bundled into client.
// =============================================================================

import "server-only";
import { PrismaClient } from "@prisma/client";

declare global {
  var __globalpay_prisma__: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? [
            { emit: "event", level: "warn" },
            { emit: "event", level: "error" },
          ]
        : [{ emit: "event", level: "error" }],
  });
}

/**
 * Global singleton Prisma client. Reuses instance across Next.js HMR in development.
 */
export const db: PrismaClient = globalThis.__globalpay_prisma__ ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__globalpay_prisma__ = db;
}

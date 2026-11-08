// =============================================================================
// GlobalPay — Traveller Preference Service
// =============================================================================
// PRD §17.1, database-schema.md §4.2:
// Server-only data access for persistent traveller preferences.
// =============================================================================

import "server-only";
import { type TravellerPreference } from "@prisma/client";
import { db } from "../db";
import { logger } from "../logging/logger";
import { type UpdatePreferencesInput } from "../validation/preferences";

export interface SafeTravellerPreferences {
  homeCountry: string;
  displayCurrency: string;
  destinations: string[];
  updatedAt: string;
}

/**
 * Retrieves the preferences for a given authenticated session.
 *
 * @param sessionId - The ID of the authenticated DemoSession.
 * @returns Safe formatted preferences or null if not set.
 */
export async function getPreferences(
  sessionId: string
): Promise<SafeTravellerPreferences | null> {
  const preference = await db.travellerPreference.findUnique({
    where: { sessionId },
  });

  if (!preference) {
    return null;
  }

  return formatSafePreferences(preference);
}

/**
 * Upserts (creates or updates) preferences for a session.
 * Guarantees idempotency and session scoping.
 *
 * @param sessionId - The ID of the authenticated DemoSession.
 * @param input - Validated preferences payload.
 * @returns Safe formatted preferences after persistence.
 */
export async function upsertPreferences(
  sessionId: string,
  input: UpdatePreferencesInput
): Promise<SafeTravellerPreferences> {
  const preference = await db.travellerPreference.upsert({
    where: { sessionId },
    create: {
      sessionId,
      homeCountry: input.homeCountry,
      displayCurrency: input.displayCurrency,
      destinations: input.destinations,
    },
    update: {
      homeCountry: input.homeCountry,
      displayCurrency: input.displayCurrency,
      destinations: input.destinations,
    },
  });

  logger.info("Updated traveller preferences for session", {
    context: {
      sessionId,
      homeCountry: input.homeCountry,
      displayCurrency: input.displayCurrency,
      destinationsCount: input.destinations.length,
    },
  });

  return formatSafePreferences(preference);
}

/**
 * Formats a database record into a safe, public API response shape.
 */
export function formatSafePreferences(
  preference: TravellerPreference
): SafeTravellerPreferences {
  let destinations: string[] = [];

  if (Array.isArray(preference.destinations)) {
    destinations = preference.destinations as string[];
  } else if (typeof preference.destinations === "string") {
    try {
      destinations = JSON.parse(preference.destinations);
    } catch {
      destinations = [];
    }
  }

  return {
    homeCountry: preference.homeCountry,
    displayCurrency: preference.displayCurrency,
    destinations,
    updatedAt: preference.updatedAt.toISOString(),
  };
}


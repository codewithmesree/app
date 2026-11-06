import { z } from "zod";

export const updatePreferencesSchema = z.object({
  homeCountry: z
    .string()
    .trim()
    .length(2, "Home country must be a 2-letter ISO code.")
    .toUpperCase(),
  displayCurrency: z
    .string()
    .trim()
    .length(3, "Display currency must be a 3-letter ISO code.")
    .toUpperCase(),
  destinations: z
    .array(
      z
        .string()
        .trim()
        .length(2, "Destination country must be a 2-letter ISO code.")
        .toUpperCase()
    )
    .min(1, "Select at least one destination country.")
    .max(10, "You can select up to 10 destination countries."),
});

export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;


import { z } from "zod";

export const quoteRequestSchema = z.object({
  baseAmount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,8})?$/, "Amount must be a positive decimal string.")
    .refine((val) => Number.parseFloat(val) > 0, "Amount must be greater than zero."),
  baseCurrency: z.string().trim().length(3, "Currency must be a 3-letter code.").toUpperCase(),
  quoteCurrency: z.string().trim().length(3, "Currency must be a 3-letter code.").toUpperCase(),
});

export type QuoteRequestInput = z.infer<typeof quoteRequestSchema>;


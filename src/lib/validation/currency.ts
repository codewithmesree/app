import { z } from "zod";
import { isSupportedFxCurrency } from "../fx/fx-provider";

export const quoteRequestSchema = z.object({
  baseAmount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,8})?$/, "Amount must be a positive decimal string.")
    .refine((val) => {
      const parts = val.split(".");
      const whole = parts[0].replace(/^0+/, "");
      return whole.length <= 9;
    }, "Amount exceeds maximum permitted limit.")
    .refine((val) => Number.parseFloat(val) > 0, "Amount must be greater than zero."),
  baseCurrency: z
    .string()
    .trim()
    .length(3, "Currency must be a 3-letter code.")
    .toUpperCase()
    .refine((val) => isSupportedFxCurrency(val), "Unsupported base currency."),
  quoteCurrency: z
    .string()
    .trim()
    .length(3, "Currency must be a 3-letter code.")
    .toUpperCase()
    .refine((val) => isSupportedFxCurrency(val), "Unsupported quote currency."),
}).refine(
  (data) => data.baseCurrency !== data.quoteCurrency,
  {
    message: "Base and quote currency must be different.",
    path: ["quoteCurrency"],
  }
);

export type QuoteRequestInput = z.infer<typeof quoteRequestSchema>;

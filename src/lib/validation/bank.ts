import { z } from "zod";

export const initiateBankLinkSchema = z.object({
  institutionId: z.string().trim().min(1, "Institution ID is required.").max(50),
  returnUrl: z.string().url("Valid return URL required.").optional(),
});

export type InitiateBankLinkInput = z.infer<typeof initiateBankLinkSchema>;

export const bankLinkCallbackSchema = z.object({
  mandateToken: z.string().trim().min(8, "Mandate token is required.").max(128),
  institutionName: z.string().trim().min(1).max(255).optional(),
  maskedAccountNumber: z
    .string()
    .trim()
    .regex(/^[•*·\d\s-]{4,20}$/, "Invalid masked account format.")
    .optional(),
  accountType: z.string().trim().max(50).optional(),
});

export type BankLinkCallbackInput = z.infer<typeof bankLinkCallbackSchema>;


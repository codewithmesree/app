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

/**
 * Validates action requests for simulated bank linking:
 * - "initiate": begin linking handshake
 * - "complete": confirm linking (with optional simulation of failure)
 * - "simulate_status": test transitional status (expired, reconnection)
 */
export const bankLinkActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("initiate"),
    institutionId: z.string().trim().min(1, "Institution ID is required.").max(50),
  }),
  z.object({
    action: z.literal("complete"),
    institutionId: z.string().trim().min(1, "Institution ID is required.").max(50),
    simulateFailure: z.boolean().default(false),
    failureReason: z.string().max(200).optional(),
  }),
  z.object({
    action: z.literal("simulate_status"),
    status: z.enum(["connection_expired", "reconnection_required"]),
  }),
]);

export type BankLinkActionInput = z.infer<typeof bankLinkActionSchema>;

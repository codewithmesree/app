import { z } from "zod";

export const merchantListQuerySchema = z.object({
  countryCode: z.string().trim().length(2).toUpperCase().optional(),
  category: z.string().trim().max(40).toLowerCase().optional(),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().trim().max(50).optional(),
});

export type MerchantListQuery = z.infer<typeof merchantListQuerySchema>;

export const merchantIdParamSchema = z.object({
  id: z.string().trim().min(1).max(140),
});

export type MerchantIdParam = z.infer<typeof merchantIdParamSchema>;

import { z } from "zod";

export const sessionResponseSchema = z.object({
  session: z.object({
    id: z.string(),
    expiresAt: z.string().datetime(),
    hasPreferences: z.boolean(),
    bankStatus: z.string(),
  }),
});

export type SessionResponse = z.infer<typeof sessionResponseSchema>;


import { z } from "zod";

export const paypalCreateOrderSchema = z.object({
  transactionId: z.string().trim().min(1, "Transaction ID is required.").max(50),
  idempotencyKey: z
    .string()
    .trim()
    .min(16, "Idempotency key must be at least 16 characters.")
    .max(128, "Idempotency key must be at most 128 characters."),
});

export type PaypalCreateOrderInput = z.infer<typeof paypalCreateOrderSchema>;

export const paypalCaptureOrderSchema = z.object({
  transactionId: z.string().trim().min(1, "Transaction ID is required.").max(50),
  idempotencyKey: z
    .string()
    .trim()
    .min(16, "Idempotency key must be at least 16 characters.")
    .max(128, "Idempotency key must be at most 128 characters."),
});

export type PaypalCaptureOrderInput = z.infer<typeof paypalCaptureOrderSchema>;


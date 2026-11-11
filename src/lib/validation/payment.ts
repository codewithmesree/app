import { z } from "zod";

export const createTransactionSchema = z.object({
  merchantId: z
    .string()
    .trim()
    .min(1, "Merchant ID is required.")
    .max(140, "Merchant ID is too long."),
  amount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,8})?$/, "Amount must be a positive decimal string.")
    .refine((val) => {
      const parts = val.split(".");
      const whole = parts[0].replace(/^0+/, "");
      return whole.length <= 9;
    }, "Amount exceeds maximum permitted limit.")
    .refine((val) => Number.parseFloat(val) > 0, "Amount must be greater than zero."),
  currency: z
    .string()
    .trim()
    .length(3, "Currency must be a 3-letter ISO code.")
    .toUpperCase(),
  quoteId: z
    .string()
    .trim()
    .max(100)
    .optional(),
});

export const createPayPalPaymentSchema = z.object({
  transactionId: z
    .string()
    .trim()
    .min(1, "Transaction ID is required.")
    .max(100),
  idempotencyKey: z
    .string()
    .trim()
    .min(8, "Idempotency key must be at least 8 characters.")
    .max(128, "Idempotency key is too long."),
});

export const capturePayPalPaymentSchema = z.object({
  transactionId: z
    .string()
    .trim()
    .min(1, "Transaction ID is required.")
    .max(100),
  idempotencyKey: z
    .string()
    .trim()
    .min(8, "Idempotency key must be at least 8 characters.")
    .max(128, "Idempotency key is too long."),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type CreatePayPalPaymentInput = z.infer<typeof createPayPalPaymentSchema>;
export type CapturePayPalPaymentInput = z.infer<typeof capturePayPalPaymentSchema>;


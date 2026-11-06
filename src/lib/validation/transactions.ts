import { z } from "zod";

export const createTransactionSchema = z.object({
  merchantId: z.string().trim().min(1, "Merchant ID is required.").max(50),
  currencyQuoteId: z.string().trim().max(50).optional(),
  amount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,8})?$/, "Amount must be a positive decimal string.")
    .refine((val) => Number.parseFloat(val) > 0, "Amount must be greater than zero."),
  currency: z.string().trim().length(3, "Currency must be a 3-letter code.").toUpperCase(),
  idempotencyKey: z
    .string()
    .trim()
    .min(16, "Idempotency key must be at least 16 characters.")
    .max(128, "Idempotency key must be at most 128 characters."),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

export const transactionListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().trim().max(50).optional(),
  status: z.enum([
    "CREATED",
    "AWAITING_APPROVAL",
    "CAPTURE_PENDING",
    "COMPLETED",
    "CANCELLED",
    "FAILED",
    "STATUS_UNKNOWN",
  ]).optional(),
});

export type TransactionListQuery = z.infer<typeof transactionListQuerySchema>;


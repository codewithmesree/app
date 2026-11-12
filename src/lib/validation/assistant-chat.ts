import { z } from "zod";

const assistantChatMessageSchema = z.object({
  role: z.enum(["user", "model"]),
  content: z.string().trim().min(1).max(4_000),
});

export const assistantChatRequestSchema = z.object({
  messages: z
    .array(assistantChatMessageSchema)
    .min(1)
    .max(12)
    .refine((messages) => messages.at(-1)?.role === "user", "The last message must be from the user.")
    .refine(
      (messages) => messages.reduce((total, message) => total + message.content.length, 0) <= 12_000,
      "The chat context is too long."
    ),
});

export type AssistantChatMessage = z.infer<typeof assistantChatMessageSchema>;

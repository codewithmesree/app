import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/ownership";
import { validateRequestOrigin } from "@/lib/auth/csrf";
import { ApiError } from "@/lib/errors/api-error";
import { handleApiError } from "@/lib/errors/error-handler";
import { generateGeminiChatResponse } from "@/lib/ai/gemini-chat";
import { InMemoryRateLimiter } from "@/lib/rate-limit/rate-limiter";
import { assistantChatRequestSchema } from "@/lib/validation/assistant-chat";
import { resolveRequestId } from "@/lib/request-id";

const chatRateLimiter = new InMemoryRateLimiter({
  windowMs: 60_000,
  maxRequests: 12,
});

export async function POST(request: Request) {
  const requestId = resolveRequestId(request);

  try {
    validateRequestOrigin(request);
    const session = await requireSession(request);
    const rateLimit = await chatRateLimiter.check(session.id);
    if (!rateLimit.allowed) {
      throw ApiError.rateLimited("Too many travel guidance messages. Please wait a moment.");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw ApiError.badRequest("Malformed JSON in request body.");
    }

    const parseResult = assistantChatRequestSchema.safeParse(body);
    if (!parseResult.success) {
      throw parseResult.error;
    }

    const reply = await generateGeminiChatResponse(parseResult.data.messages, requestId);

    return NextResponse.json(
      { reply },
      {
        status: 200,
        headers: {
          "x-request-id": requestId,
          "cache-control": "no-store",
        },
      }
    );
  } catch (error) {
    return handleApiError(error, request, requestId);
  }
}

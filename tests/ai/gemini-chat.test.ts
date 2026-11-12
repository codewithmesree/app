import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";
import { ApiError } from "@/lib/errors/api-error";
import { generateGeminiChatResponse } from "@/lib/ai/gemini-chat";
import { assistantChatRequestSchema } from "@/lib/validation/assistant-chat";

const originalProvider = process.env.AI_PROVIDER;
const originalApiKey = process.env.AI_API_KEY;
const originalModel = process.env.AI_MODEL;
const originalFetch = globalThis.fetch;

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

describe("Gemini travel guidance chat", () => {
  beforeEach(() => {
    process.env.AI_PROVIDER = "gemini";
    process.env.AI_API_KEY = "test-api-key";
    process.env.AI_MODEL = "gemini-3.8-flash";
    globalThis.fetch = originalFetch;
  });

  after(() => {
    restoreEnv("AI_PROVIDER", originalProvider);
    restoreEnv("AI_API_KEY", originalApiKey);
    restoreEnv("AI_MODEL", originalModel);
    globalThis.fetch = originalFetch;
  });

  it("rejects chat input that does not end with a user message", () => {
    const result = assistantChatRequestSchema.safeParse({
      messages: [{ role: "model", content: "Unexpected assistant message." }],
    });

    assert.strictEqual(result.success, false);
  });

  it("returns a clear configuration error when the API key is missing", async () => {
    delete process.env.AI_API_KEY;
    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      return new Response();
    };

    await assert.rejects(
      generateGeminiChatResponse([{ role: "user", content: "Explain the demo." }]),
      (error: unknown) => error instanceof ApiError && error.code === "AI_UNAVAILABLE"
    );
    assert.strictEqual(fetchCalled, false);
  });

  it("sends the key only in the server-side header and extracts Gemini text", async () => {
    globalThis.fetch = async (input, init) => {
      const requestUrl = input instanceof Request ? input.url : String(input);
      assert.strictEqual(new URL(requestUrl).hostname, "generativelanguage.googleapis.com");
      assert.strictEqual(new URL(requestUrl).pathname, "/v1beta/models/gemini-3.8-flash:generateContent");
      assert.strictEqual(new URL(requestUrl).search, "");
      assert.strictEqual(new Headers(init?.headers).get("x-goog-api-key"), "test-api-key");

      const body: unknown = JSON.parse(String(init?.body));
      assert.strictEqual(
        typeof body === "object" && body !== null && "systemInstruction" in body,
        true
      );
      assert.deepStrictEqual(
        typeof body === "object" && body !== null && "generationConfig" in body
          ? body.generationConfig
          : null,
        {
          temperature: 0.4,
          maxOutputTokens: 700,
          thinkingConfig: { thinkingLevel: "LOW" },
        }
      );
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: "Sandbox payments are for demos." }] } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const reply = await generateGeminiChatResponse([
      { role: "user", content: "Explain the demo." },
    ]);

    assert.strictEqual(reply, "Sandbox payments are for demos.");
  });

  it("explains when Gemini no longer has the configured model", async () => {
    globalThis.fetch = async () => new Response(null, { status: 404 });

    await assert.rejects(
      generateGeminiChatResponse([{ role: "user", content: "Explain the demo." }]),
      (error: unknown) =>
        error instanceof ApiError &&
        error.code === "AI_PROVIDER_ERROR" &&
        error.message.includes("Gemini model") &&
        error.message.includes("gemini-3.8-flash")
    );
  });

  it("distinguishes invalid API keys from quota limits", async () => {
    globalThis.fetch = async () => new Response(null, { status: 401 });
    await assert.rejects(
      generateGeminiChatResponse([{ role: "user", content: "Explain the demo." }]),
      (error: unknown) =>
        error instanceof ApiError &&
        error.code === "AI_PROVIDER_ERROR" &&
        error.message.includes("API key")
    );

    globalThis.fetch = async () => new Response(null, { status: 429 });
    await assert.rejects(
      generateGeminiChatResponse([{ role: "user", content: "Explain the demo." }]),
      (error: unknown) =>
        error instanceof ApiError &&
        error.code === "RATE_LIMITED" &&
        error.statusCode === 429 &&
        error.message.includes("quota")
    );
  });

  it("recognises Gemini's 400 API_KEY_INVALID response as an invalid key", async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          error: {
            code: 400,
            status: "INVALID_ARGUMENT",
            message: "API key not valid. Please pass a valid API key.",
            details: [{ "@type": "type.googleapis.com/google.rpc.ErrorInfo", reason: "API_KEY_INVALID" }],
          },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );

    await assert.rejects(
      generateGeminiChatResponse([{ role: "user", content: "Explain the demo." }]),
      (error: unknown) =>
        error instanceof ApiError &&
        error.code === "AI_PROVIDER_ERROR" &&
        error.message.includes("API key") &&
        !error.message.includes("not valid. Please pass")
    );
  });

  it("reports Gemini overload (503) as temporary unavailability, not a timeout", async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({ error: { code: 503, status: "UNAVAILABLE", message: "The model is overloaded." } }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );

    await assert.rejects(
      generateGeminiChatResponse([{ role: "user", content: "Explain the demo." }]),
      (error: unknown) =>
        error instanceof ApiError &&
        error.code === "AI_UNAVAILABLE" &&
        error.statusCode === 503 &&
        error.message.includes("temporarily unavailable")
    );
  });

  it("reports network failures separately from Gemini HTTP errors", async () => {
    globalThis.fetch = async () => {
      throw new TypeError("Connection failed");
    };

    await assert.rejects(
      generateGeminiChatResponse([{ role: "user", content: "Explain the demo." }]),
      (error: unknown) =>
        error instanceof ApiError &&
        error.code === "AI_PROVIDER_ERROR" &&
        error.message.includes("network connection")
    );
  });

  it("reports provider aborts as timeouts", async () => {
    globalThis.fetch = async () => {
      throw new DOMException("The operation was aborted.", "AbortError");
    };

    await assert.rejects(
      generateGeminiChatResponse([{ role: "user", content: "Explain the demo." }]),
      (error: unknown) => error instanceof ApiError && error.code === "AI_TIMEOUT"
    );
  });
});

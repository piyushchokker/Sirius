import { auth } from "@/lib/auth";
import { DEFAULT_OPENAI_MODEL, OPENAI_FAST_SERVICE_TIER } from "@/lib/ai-models";
import { NextRequest, NextResponse } from "next/server";
import { streamText } from "ai";
import { openai, createOpenAI } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

export const maxDuration = 60;

const requestSchema = z.object({
  message: z.string().trim().min(1).max(32_000),
  model: z.string().trim().min(1).max(100).default(DEFAULT_OPENAI_MODEL),
  provider: z.enum(["openai", "anthropic", "ollama"]).default("openai"),
  systemPrompt: z.string().max(8_000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(16_000).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid playground request." }, { status: 400 });
  const { message, model, provider, systemPrompt, temperature, maxTokens } = parsed.data;

  if (provider === "openai" && !process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OpenAI is not configured on the server." }, { status: 503 });
  }
  if (provider === "anthropic" && !process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Anthropic is not configured on the server." }, { status: 503 });
  }

  try {
    const languageModel = provider === "anthropic"
      ? anthropic(model)
      : provider === "ollama"
        ? createOpenAI({
            baseURL: `${(process.env.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\/$/, "")}/v1`,
            apiKey: "ollama",
          })(model)
        : openai(model);
    const result = streamText({
      model: languageModel,
      system: systemPrompt?.trim() || undefined,
      prompt: message,
      temperature,
      maxOutputTokens: maxTokens,
      ...(provider === "openai" && model === DEFAULT_OPENAI_MODEL
        ? { providerOptions: { openai: { serviceTier: OPENAI_FAST_SERVICE_TIER, reasoningEffort: "none" } } }
        : {}),
    });
    return result.toTextStreamResponse();
  } catch (error) {
    console.error("Playground request failed", error);
    return NextResponse.json({ error: "The playground request could not be completed." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, ApiError, Type } from "@google/genai";
import { z } from "zod";
import { requireUser } from "@/lib/auth";

const reviewRequestSchema = z.object({
  title: z.string().trim().max(120),
  markdown: z.string().trim().min(1).max(30000),
  presentationMinutes: z.number().int().min(1).max(180),
  language: z.enum(["ja", "en"]),
});

const reviewSchema = z.object({
  summary: z.string().trim().min(1),
  suggestions: z
    .array(
      z.object({
        slide: z.number().int().min(1).nullable().optional(),
        severity: z.enum(["high", "medium", "low"]),
        message: z.string().trim().min(1),
      }),
    )
    .default([]),
});

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    suggestions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          slide: { type: Type.NUMBER, nullable: true },
          severity: {
            type: Type.STRING,
            enum: ["high", "medium", "low"],
          },
          message: { type: Type.STRING },
        },
        required: ["severity", "message"],
      },
    },
  },
  required: ["summary", "suggestions"],
};

function getAi() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  return new GoogleGenAI({ apiKey });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function isQuotaExhausted(error: unknown) {
  if (!(error instanceof ApiError)) return false;

  const message = getErrorMessage(error);

  return (
    error.status === 429 &&
    (
      message.includes("RESOURCE_EXHAUSTED") ||
      message.includes("Quota exceeded") ||
      message.includes("free_tier_requests") ||
      message.includes("free_tier_input_token_count")
    )
  );
}

function isRetryableError(error: unknown) {
  if (!(error instanceof ApiError)) return false;

  if (isQuotaExhausted(error)) {
    return false;
  }

  return [429, 500, 503].includes(error.status ?? 0);
}

function reviewPrompt(input: z.infer<typeof reviewRequestSchema>) {
  const outputLanguage = input.language === "ja" ? "Japanese" : "English";

  return `You are a senior lightning-talk coach reviewing a Markdown slide deck.

Return concise, practical feedback in ${outputLanguage}.

Deck title:
${input.title || "Untitled"}

Target duration:
${input.presentationMinutes} minutes

Review goals:
- Judge whether the deck fits the target duration.
- Find slides that are too dense, unclear, or missing a stronger takeaway.
- Prefer specific, actionable advice over generic encouragement.
- Keep the response short enough to scan while editing.

Markdown deck:
${input.markdown}`;
}

function getModels() {
  const primary = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  return Array.from(
    new Set([
      primary,
      "gemini-2.5-flash-lite",
    ]),
  );
}

async function generateWithRetry<T>(fn: () => Promise<T>) {
  const maxRetries = 3;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!isRetryableError(error)) {
        throw error;
      }

      if (attempt === maxRetries) {
        throw error;
      }

      const delay =
        Math.min(1000 * 2 ** attempt, 8000) +
        Math.random() * 500;

      console.warn(
        `Retrying Gemini request (${attempt + 1}/${maxRetries}) after ${Math.round(delay)}ms`,
      );

      await sleep(delay);
    }
  }

  throw new Error("Unreachable");
}

async function generateReview(input: z.infer<typeof reviewRequestSchema>) {
  const ai = getAi();
  const models = getModels();

  let lastError: unknown;

  for (const model of models) {
    try {
      const response = await generateWithRetry(() =>
        ai.models.generateContent({
          model,
          contents: reviewPrompt(input),
          config: {
            temperature: 0.3,
            maxOutputTokens: 1200,
            responseMimeType: "application/json",
            responseSchema,
          },
        }),
      );

      const text = response.text;

      if (!text?.trim()) {
        throw new Error(`Gemini returned empty response. model=${model}`);
      }

      const parsed = JSON.parse(text);

      return reviewSchema.parse(parsed);
    } catch (error) {
      lastError = error;

      if (isQuotaExhausted(error)) {
        console.error(`Model quota exhausted: ${model}`, error);
        continue;
      }

      console.error(`Model failed: ${model}`, error);
      continue;
    }
  }

  throw lastError;
}

export async function POST(request: NextRequest) {
  try {
    await requireUser(request);

    const input = reviewRequestSchema.parse(await request.json());

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured" },
        { status: 503 },
      );
    }

    const review = await generateReview(input);

    return NextResponse.json({ review });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: error.flatten(),
        },
        { status: 400 },
      );
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Gemini returned invalid JSON" },
        { status: 502 },
      );
    }

    if (isQuotaExhausted(error)) {
      return NextResponse.json(
        {
          error: "Gemini quota exhausted",
          message: "Gemini API quota has been exhausted. Check your billing plan or rate limits.",
        },
        { status: 429 },
      );
    }

    if (error instanceof ApiError) {
      return NextResponse.json(
        {
          error: "Gemini API error",
          status: error.status,
          message: error.message,
        },
        { status: error.status || 502 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "GEMINI_API_KEY is not configured"
    ) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured" },
        { status: 503 },
      );
    }

    console.error(error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
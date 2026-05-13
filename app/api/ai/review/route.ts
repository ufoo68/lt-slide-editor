import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, ApiError } from "@google/genai";
import { z } from "zod";
import { requireUser } from "@/lib/auth";

const reviewRequestSchema = z.object({
  title: z.string().trim().max(120),
  background: z.string().trim().max(5000).optional().default(""),
  markdown: z.string().trim().max(30000),
  selectedText: z.string().trim().min(1).max(5000),
  language: z.enum(["ja", "en"]),
});

const reviewSchema = z.object({
  selectedText: z.string().trim().min(1),
  answer: z.string().trim().min(1),
  sources: z
    .array(
      z.object({
        title: z.string().trim().min(1),
        url: z.string().trim().url(),
        note: z.string().trim().min(1),
      }),
    )
    .default([]),
});

type FactCheckReview = z.infer<typeof reviewSchema>;

type GroundingSource = {
  title: string;
  url: string;
  note: string;
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

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function extractGroundingSources(response: unknown): GroundingSource[] {
  const candidates = (response as { candidates?: unknown[] }).candidates;
  const sources = new Map<string, GroundingSource>();

  if (!Array.isArray(candidates)) return [];

  for (const candidate of candidates) {
    const groundingChunks = (candidate as { groundingMetadata?: { groundingChunks?: unknown[] } })
      .groundingMetadata?.groundingChunks;

    if (!Array.isArray(groundingChunks)) continue;

    for (const chunk of groundingChunks) {
      const web = (chunk as { web?: { title?: unknown; uri?: unknown } }).web;
      const url = getString(web?.uri);

      if (!isValidHttpUrl(url) || sources.has(url)) continue;

      sources.set(url, {
        title: getString(web?.title) || url,
        url,
        note: "Google Search grounding source.",
      });
    }
  }

  return Array.from(sources.values()).slice(0, 5);
}

function extractUrlSources(text: string): GroundingSource[] {
  const urls = text.match(/https?:\/\/[^\s)\]}>"]+/g) ?? [];
  const sources = new Map<string, GroundingSource>();

  for (const rawUrl of urls) {
    const url = rawUrl.replace(/[.,;:!?]+$/, "");

    if (!isValidHttpUrl(url) || sources.has(url)) continue;

    sources.set(url, {
      title: url,
      url,
      note: "Source URL included in the answer.",
    });
  }

  return Array.from(sources.values());
}

function mergeSources(...sourceGroups: GroundingSource[][]) {
  const sources = new Map<string, GroundingSource>();

  for (const group of sourceGroups) {
    for (const source of group) {
      if (!sources.has(source.url)) {
        sources.set(source.url, source);
      }
    }
  }

  return Array.from(sources.values()).slice(0, 8);
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

  return `You are a careful fact-checker for a Markdown slide editor.

Use Google Search for current and primary-source evidence where possible.
Return concise fact-check results in ${outputLanguage} as plain text.

Deck title:
${input.title || "Untitled"}

Selected text to fact-check:
${input.selectedText}

User-provided background:
${input.background || "(none)"}

Available deck context:
${input.markdown || "(no additional context)"}

Rules:
- Verify only the selected text.
- Use the user-provided background and deck context only to understand ambiguous references, terms, timeframes, or scope.
- Start with a short judgement such as supported, unsupported, mixed, or uncertain, translated for the output language.
- Explain the reasoning in a few short paragraphs or bullets.
- Include 1-5 source URLs. Prefer official pages, documentation, papers, standards, or reputable news.
- Every source must be a real URL used to support the answer.
- Do not invent URLs or citations.
- Keep answer practical and easy to scan while editing.
- Do not return JSON.`;
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
            tools: [{ googleSearch: {} }],
          },
        }),
      );

      const text = response.text;

      if (!text?.trim()) {
        throw new Error(`Gemini returned empty response. model=${model}`);
      }

      return reviewSchema.parse({
        answer: text.trim(),
        selectedText: input.selectedText,
        sources: mergeSources(
          extractGroundingSources(response),
          extractUrlSources(text),
        ),
      } satisfies FactCheckReview);
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

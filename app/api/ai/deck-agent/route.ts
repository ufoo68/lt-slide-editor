import { NextRequest, NextResponse } from "next/server";
import { ApiError, GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { requireUser } from "@/lib/auth";

const requestSchema = z.object({
  currentMarkdown: z.string().max(60000).optional().default(""),
  language: z.enum(["ja", "en"]),
  presentationMinutes: z.number().int().min(1).max(180),
  prompt: z.string().trim().min(1).max(8000),
  title: z.string().trim().max(120),
});

const resultSchema = z.object({
  markdown: z.string().trim().min(1).max(60000),
  notes: z.string().trim().max(2000).default(""),
});

type SlideAgentResult = z.infer<typeof resultSchema>;

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

      const delay = Math.min(1000 * 2 ** attempt, 8000) + Math.random() * 500;

      console.warn(`Retrying Gemini request (${attempt + 1}/${maxRetries}) after ${Math.round(delay)}ms`);

      await sleep(delay);
    }
  }

  throw new Error("Unreachable");
}

function stripMarkdownFence(markdown: string) {
  const trimmed = markdown.trim();
  const match = trimmed.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i);
  return (match?.[1] ?? trimmed).trim();
}

function extractJson(text: string) {
  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }

  return text;
}

function normalizeResult(value: unknown) {
  const parsed = resultSchema.parse(value);

  return {
    ...parsed,
    markdown: stripMarkdownFence(parsed.markdown),
  } satisfies SlideAgentResult;
}

function agentPrompt(input: z.infer<typeof requestSchema>) {
  const outputLanguage = input.language === "ja" ? "Japanese" : "English";
  const slideCountHint = Math.max(4, Math.min(14, Math.round(input.presentationMinutes * 1.2)));

  return `You are an expert lightning-talk slide agent for LT Slide Editor.

Generate complete Full Markdown for a ${input.presentationMinutes}-minute lightning talk.
The output language is ${outputLanguage}.

The editor format:
- Optional YAML front matter at the top:
  ---
  theme: light
  header: ""
  footer: ""
  ---
- Separate slides with a line containing only ---
- Use normal Markdown: headings, bullets, code fences, images, and mermaid diagrams.
- Mermaid diagrams must be concise and fit in a 16:9 slide.

User request:
${input.prompt}

Current deck title:
${input.title || "Untitled"}

Current Full Markdown, if useful as context or revision target:
${input.currentMarkdown || "(none)"}

LT-specific requirements:
- Create a practical ${slideCountHint}-slide structure unless the user asks otherwise.
- Make the first slide a strong title slide.
- Keep each slide scannable: short headings, few bullets, no dense paragraphs.
- Prefer concrete story flow: hook, context, problem, approach, demo/code/example, takeaway.
- Include speaker-useful wording, but do not write a long script.
- Use code or Mermaid only when it genuinely helps.
- Preserve useful existing front matter from the current deck when revising.
- Return a full replacement Markdown deck, not a patch.
- Do not wrap the Markdown in a code fence.

Return JSON only with this shape:
{
  "markdown": "complete Full Markdown deck",
  "notes": "short summary of what you generated or changed"
}`;
}

async function generateDeck(input: z.infer<typeof requestSchema>) {
  const ai = getAi();
  const models = getModels();
  let lastError: unknown;

  for (const model of models) {
    try {
      const response = await generateWithRetry(() =>
        ai.models.generateContent({
          model,
          contents: agentPrompt(input),
          config: {
            maxOutputTokens: 12000,
            responseMimeType: "application/json",
            temperature: 0.75,
          },
        }),
      );

      const text = response.text;

      if (!text?.trim()) {
        throw new Error(`Gemini returned empty response. model=${model}`);
      }

      return normalizeResult(JSON.parse(extractJson(text)));
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

    const input = requestSchema.parse(await request.json());

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured" },
        { status: 503 },
      );
    }

    const result = await generateDeck(input);

    return NextResponse.json({ result });
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
          message: error.message,
          status: error.status,
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

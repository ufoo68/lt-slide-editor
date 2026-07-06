import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createDeck, listDecks } from "@/lib/database";
import { uniqueDeckSlug } from "@/lib/slug";

const createDeckSchema = z.object({
  title: z.string().trim().min(1).max(120),
  markdown: z.string().default("# 新しいLT\n\n- ここに話すことを書く"),
  presentationMinutes: z.number().int().min(1).max(180).default(5),
  visibility: z.enum(["private", "public"]).default("private"),
});

function apiError(error: unknown) {
  if (error instanceof Response) {
    return error;
  }
  console.error(error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const decks = await listDecks(user.id);
    return NextResponse.json({ decks });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const input = createDeckSchema.parse(await request.json());
    const slug = await uniqueDeckSlug(input.title);

    const deck = await createDeck({
      userId: user.id,
      title: input.title,
      markdown: input.markdown,
      presentationMinutes: input.presentationMinutes,
      visibility: input.visibility,
      slug,
    });

    return NextResponse.json({ deck }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return apiError(error);
  }
}

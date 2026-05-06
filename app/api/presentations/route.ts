import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uniqueDeckSlug } from "@/lib/slug";

const createDeckSchema = z.object({
  title: z.string().trim().min(1).max(120),
  markdown: z.string().default("# 新しいLT\n\n- ここに話すことを書く"),
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
    const decks = await prisma.deck.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        visibility: true,
        createdAt: true,
        updatedAt: true,
      },
    });
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

    const deck = await prisma.deck.create({
      data: {
        userId: user.id,
        title: input.title,
        markdown: input.markdown,
        visibility: input.visibility,
        slug,
        versions: {
          create: { markdown: input.markdown },
        },
      },
      select: {
        id: true,
        title: true,
        slug: true,
        markdown: true,
        visibility: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ deck }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return apiError(error);
  }
}

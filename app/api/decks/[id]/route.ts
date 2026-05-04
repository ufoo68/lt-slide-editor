import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateDeckSchema = z.object({
  title: z.string().trim().min(1).max(120),
  markdown: z.string(),
  visibility: z.enum(["private", "public"]),
});

function apiError(error: unknown) {
  if (error instanceof Response) {
    return error;
  }
  console.error(error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const user = await requireUser(request);
    const deck = await prisma.deck.findFirst({
      where: { id: params.id, userId: user.id },
      select: {
        id: true,
        title: true,
        slug: true,
        markdown: true,
        visibility: true,
        updatedAt: true,
      },
    });

    if (!deck) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ deck });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const user = await requireUser(request);
    const input = updateDeckSchema.parse(await request.json());

    const current = await prisma.deck.findFirst({
      where: { id: params.id, userId: user.id },
      select: { id: true, markdown: true },
    });

    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const deck = await prisma.deck.update({
      where: { id: current.id },
      data: {
        title: input.title,
        markdown: input.markdown,
        visibility: input.visibility,
        versions: current.markdown === input.markdown ? undefined : { create: { markdown: input.markdown } },
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

    return NextResponse.json({ deck });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const user = await requireUser(request);
    const deck = await prisma.deck.findFirst({
      where: { id: params.id, userId: user.id },
      select: { id: true },
    });

    if (!deck) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.deck.delete({
      where: { id: deck.id },
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { deleteDeck, getDeckForUser, toClientDeck, updateDeck } from "@/lib/database";

const updateDeckSchema = z.object({
  title: z.string().trim().min(1).max(120),
  markdown: z.string(),
  presentationMinutes: z.number().int().min(1).max(180),
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
    const deck = await getDeckForUser(params.id, user.id);

    if (!deck) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ deck: toClientDeck(deck) });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const user = await requireUser(request);
    const input = updateDeckSchema.parse(await request.json());

    const deck = await updateDeck(params.id, user.id, input);
    if (!deck) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ deck: toClientDeck(deck) });
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
    const deleted = await deleteDeck(params.id, user.id);
    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}

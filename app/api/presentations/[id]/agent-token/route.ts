import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createDeckAgentToken } from "@/lib/deck-agent-token";
import { getDeckForUser, setDeckAgentTokenHash, toClientDeck } from "@/lib/database";

function apiError(error: unknown) {
  if (error instanceof Response) {
    return error;
  }
  console.error(error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const user = await requireUser(request);
    const deck = await getDeckForUser(params.id, user.id);

    if (!deck) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { token, tokenHash } = createDeckAgentToken(deck.id);
    const updatedDeck = await setDeckAgentTokenHash(deck.id, user.id, tokenHash);

    return NextResponse.json({
      deck: updatedDeck ? toClientDeck(updatedDeck) : null,
      token,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const user = await requireUser(request);
    const deck = await setDeckAgentTokenHash(params.id, user.id, null);

    if (!deck) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ deck: toClientDeck(deck) });
  } catch (error) {
    return apiError(error);
  }
}

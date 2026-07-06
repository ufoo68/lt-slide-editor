import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getDeckForUser, listDeckVersions } from "@/lib/database";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const user = await requireUser(request);
    const deck = await getDeckForUser(params.id, user.id);

    if (!deck) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const versions = await listDeckVersions(deck.id);

    return NextResponse.json({ versions });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

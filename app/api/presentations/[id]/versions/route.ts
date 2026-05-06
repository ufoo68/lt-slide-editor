import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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

    const versions = await prisma.deckVersion.findMany({
      where: { deckId: deck.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, createdAt: true },
    });

    return NextResponse.json({ versions });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

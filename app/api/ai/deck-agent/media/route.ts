import { NextRequest, NextResponse } from "next/server";
import { createMedia, getDeckById, listMedia } from "@/lib/database";
import { parseDeckAgentToken, verifyDeckAgentToken } from "@/lib/deck-agent-token";
import { serializeMedia, validateMediaFile } from "@/lib/media";
import { mediaLibraryPath, uploadObject } from "@/lib/storage";

async function authorize(request: NextRequest, deckId: string) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  const parsed = token ? parseDeckAgentToken(token) : null;
  if (!parsed || parsed.deckId !== deckId) throw new Response("Deck token does not match deckId", { status: 403 });
  const deck = await getDeckById(deckId);
  if (!token || !deck || !verifyDeckAgentToken({ expectedHash: deck.agentTokenHash, token })) {
    throw new Response("Unauthorized", { status: 401 });
  }
  return deck;
}

function apiError(error: unknown) {
  if (error instanceof Response) return error;
  console.error(error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const deckId = request.nextUrl.searchParams.get("deckId")?.trim();
    if (!deckId) return NextResponse.json({ error: "deckId is required" }, { status: 400 });
    const deck = await authorize(request, deckId);
    return NextResponse.json({ media: (await listMedia(deck.userId)).map(serializeMedia) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const deckId = String(formData.get("deckId") ?? "").trim();
    if (!deckId) return NextResponse.json({ error: "deckId is required" }, { status: 400 });
    const deck = await authorize(request, deckId);
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "file is required" }, { status: 400 });
    const validationError = validateMediaFile(file);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

    const storagePath = mediaLibraryPath(deck.userId, file.name);
    await uploadObject(storagePath, Buffer.from(await file.arrayBuffer()), file.type);
    const media = await createMedia({ userId: deck.userId, filename: file.name, storagePath, contentType: file.type, size: file.size });
    return NextResponse.json({ media: serializeMedia(media) }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { deleteMedia, getMediaForUser } from "@/lib/database";
import { deleteObject } from "@/lib/storage";

function apiError(error: unknown) {
  if (error instanceof Response) {
    return error;
  }
  console.error(error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const user = await requireUser(request);
    const media = await getMediaForUser(params.id, user.id);

    if (!media) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await deleteObject(media.storagePath);
    await deleteMedia(params.id, user.id);

    return new Response(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}

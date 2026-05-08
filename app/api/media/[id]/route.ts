import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
    const media = await prisma.mediaLibraryItem.findFirst({
      where: { id: params.id, userId: user.id },
      select: { id: true, storagePath: true },
    });

    if (!media) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await deleteObject(media.storagePath);
    await prisma.mediaLibraryItem.delete({
      where: { id: media.id },
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}

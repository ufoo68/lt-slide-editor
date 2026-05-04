import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readObject } from "@/lib/storage";

function apiError(error: unknown) {
  console.error(error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const image = await prisma.imageLibraryItem.findUnique({
      where: { id: params.id },
      select: { contentType: true, storagePath: true },
    });

    if (!image) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const object = await readObject(image.storagePath);
    return new Response(object.body, {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Content-Type": object.contentType || image.contentType,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

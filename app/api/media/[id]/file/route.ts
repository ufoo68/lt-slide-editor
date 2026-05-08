import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readObject } from "@/lib/storage";

function apiError(error: unknown) {
  console.error(error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const media = await prisma.mediaLibraryItem.findUnique({
      where: { id: params.id },
      select: { contentType: true, storagePath: true },
    });

    if (!media) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const object = await readObject(media.storagePath);
    const contentType = object.contentType || media.contentType;
    const size = object.body.size;
    const range = request.headers.get("range");
    if (range) {
      const match = range.match(/^bytes=(\d*)-(\d*)$/);
      if (!match) {
        return NextResponse.json({ error: "Invalid range" }, { status: 416 });
      }

      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Number(match[2]) : size - 1;
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end >= size) {
        return new Response(null, {
          status: 416,
          headers: {
            "Content-Range": `bytes */${size}`,
          },
        });
      }

      return new Response(object.body.slice(start, end + 1, contentType), {
        status: 206,
        headers: {
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=3600",
          "Content-Length": String(end - start + 1),
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Content-Type": contentType,
        },
      });
    }

    return new Response(object.body, {
      headers: {
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=3600",
        "Content-Length": String(size),
        "Content-Type": contentType,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

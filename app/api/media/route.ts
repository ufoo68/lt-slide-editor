import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createMedia, listMedia } from "@/lib/database";
import { mediaLibraryPath, uploadObject } from "@/lib/storage";

const allowedStillMediaTypes = new Set(["image/gif", "image/jpeg", "image/png", "image/svg+xml", "image/webp"]);
const allowedVideoTypes = new Set(["video/mp4", "video/ogg", "video/quicktime", "video/webm"]);
const maxStillMediaSize = 5 * 1024 * 1024;
const maxVideoSize = 100 * 1024 * 1024;

function apiError(error: unknown) {
  if (error instanceof Response) {
    return error;
  }
  console.error(error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

function escapeAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function mediaMarkdown(media: { contentType: string; filename: string; id: string }) {
  const src = `/api/media/${media.id}/file`;
  const style = "position:absolute;left:29%;top:33%;width:42%;height:34%;object-fit:contain;";
  if (media.contentType.startsWith("video/")) {
    return `<video controls src="${src}" title="${escapeAttribute(media.filename)}" style="${style}"></video>`;
  }
  return `<img src="${src}" alt="${escapeAttribute(media.filename)}" style="${style}">`;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const media = await listMedia(user.id);

    return NextResponse.json({
      media: media.map((item) => ({
        ...item,
        markdown: mediaMarkdown(item),
        url: `/api/media/${item.id}/file`,
      })),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (!allowedStillMediaTypes.has(file.type) && !allowedVideoTypes.has(file.type)) {
      return NextResponse.json({ error: "unsupported media type" }, { status: 400 });
    }
    const maxSize = file.type.startsWith("video/") ? maxVideoSize : maxStillMediaSize;
    if (file.size > maxSize) {
      return NextResponse.json({ error: "media is too large" }, { status: 400 });
    }

    const body = Buffer.from(await file.arrayBuffer());
    const storagePath = mediaLibraryPath(user.id, file.name);
    await uploadObject(storagePath, body, file.type);

    const media = await createMedia({
      userId: user.id,
      filename: file.name,
      storagePath,
      contentType: file.type,
      size: file.size,
    });

    return NextResponse.json(
      {
        media: {
          ...media,
          markdown: mediaMarkdown(media),
          url: `/api/media/${media.id}/file`,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}

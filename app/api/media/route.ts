import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createMedia, listMedia } from "@/lib/database";
import { mediaLibraryPath, uploadObject } from "@/lib/storage";
import { serializeMedia, validateMediaFile } from "@/lib/media";

function apiError(error: unknown) {
  if (error instanceof Response) {
    return error;
  }
  console.error(error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const media = await listMedia(user.id);

    return NextResponse.json({
      media: media.map(serializeMedia),
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
    const validationError = validateMediaFile(file);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
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
        media: serializeMedia(media),
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}

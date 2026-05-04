import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { imageLibraryPath, uploadObject } from "@/lib/storage";

const allowedImageTypes = new Set(["image/gif", "image/jpeg", "image/png", "image/svg+xml", "image/webp"]);
const maxImageSize = 5 * 1024 * 1024;

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
    const images = await prisma.imageLibraryItem.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        filename: true,
        contentType: true,
        size: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      images: images.map((image) => ({
        ...image,
        markdown: `![${image.filename}](/api/images/${image.id}/file)`,
        url: `/api/images/${image.id}/file`,
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
    if (!allowedImageTypes.has(file.type)) {
      return NextResponse.json({ error: "unsupported image type" }, { status: 400 });
    }
    if (file.size > maxImageSize) {
      return NextResponse.json({ error: "image is too large" }, { status: 400 });
    }

    const body = Buffer.from(await file.arrayBuffer());
    const storagePath = imageLibraryPath(user.id, file.name);
    await uploadObject(storagePath, body, file.type);

    const image = await prisma.imageLibraryItem.create({
      data: {
        userId: user.id,
        filename: file.name,
        storagePath,
        contentType: file.type,
        size: file.size,
      },
      select: {
        id: true,
        filename: true,
        contentType: true,
        size: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      {
        image: {
          ...image,
          markdown: `![${image.filename}](/api/images/${image.id}/file)`,
          url: `/api/images/${image.id}/file`,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}

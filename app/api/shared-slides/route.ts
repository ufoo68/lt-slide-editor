import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { splitSlides } from "@/lib/markdown";
import { prisma } from "@/lib/prisma";

const createSlideSchema = z.object({
  title: z.string().trim().min(1).max(80),
  markdown: z
    .string()
    .trim()
    .min(1)
    .max(8000)
    .refine((markdown) => splitSlides(markdown).length === 1 && !/\n---\s*(?:\n|$)/.test(markdown), {
      message: "共有スライドは1ページだけ保存できます",
    }),
});

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
    const slides = await prisma.slideLibraryItem.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        markdown: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ slides });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const input = createSlideSchema.parse(await request.json());

    const slide = await prisma.slideLibraryItem.create({
      data: {
        userId: user.id,
        title: input.title,
        markdown: input.markdown,
      },
      select: {
        id: true,
        title: true,
        markdown: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ slide }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return apiError(error);
  }
}

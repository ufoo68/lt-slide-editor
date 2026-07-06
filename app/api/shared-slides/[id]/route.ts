import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { deleteSlide, getSlideForUser, updateSlide } from "@/lib/database";
import { splitSlides } from "@/lib/markdown";

const updateSlideSchema = z.object({
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

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const user = await requireUser(request);
    const slide = await getSlideForUser(params.id, user.id);

    if (!slide) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ slide });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const user = await requireUser(request);
    const input = updateSlideSchema.parse(await request.json());
    const slide = await updateSlide(params.id, user.id, input);
    if (!slide) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ slide });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const user = await requireUser(request);
    const deleted = await deleteSlide(params.id, user.id);
    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}

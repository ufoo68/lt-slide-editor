import slugify from "slugify";
import { prisma } from "@/lib/prisma";

export async function uniqueDeckSlug(title: string) {
  const base =
    slugify(title, { lower: true, strict: true, trim: true }) ||
    `deck-${Math.random().toString(36).slice(2, 8)}`;
  let slug = base;
  let suffix = 2;

  while (await prisma.deck.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

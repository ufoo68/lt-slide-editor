import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { renderSlides } from "@/lib/markdown";
import { PublicSlideshow } from "@/components/PublicSlideshow";

export default async function PublicDeckPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const deck = await prisma.deck.findFirst({
    where: { slug, visibility: "public" },
    select: { title: true, markdown: true, presentationMinutes: true, updatedAt: true },
  });

  if (!deck) {
    notFound();
  }

  const slides = renderSlides(deck.markdown);

  return (
    <PublicSlideshow
      slides={slides.map((slide) => ({ index: slide.index, html: slide.html }))}
      presentationMinutes={deck.presentationMinutes}
      title={deck.title}
      updatedAt={new Date(deck.updatedAt).toLocaleDateString("ja-JP")}
    />
  );
}

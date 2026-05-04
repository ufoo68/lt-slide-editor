import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { renderSlides } from "@/lib/markdown";

export default async function PublicDeckPage({ params }: { params: { slug: string } }) {
  const deck = await prisma.deck.findFirst({
    where: { slug: params.slug, visibility: "public" },
    select: { title: true, markdown: true, updatedAt: true },
  });

  if (!deck) {
    notFound();
  }

  const slides = renderSlides(deck.markdown);

  return (
    <main className="min-h-screen bg-ink text-ink">
      <div className="mx-auto max-w-6xl px-4 py-5">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3 text-white">
          <h1 className="text-xl font-black">{deck.title}</h1>
          <p className="text-sm text-white/70">Updated {new Date(deck.updatedAt).toLocaleDateString("ja-JP")}</p>
        </header>
        <div className="grid gap-6">
          {slides.map((slide) => (
            <section className="aspect-video overflow-hidden rounded-lg bg-white shadow-panel" key={slide.index}>
              <article
                className="slide-content flex h-full flex-col justify-center p-10"
                dangerouslySetInnerHTML={{ __html: slide.html }}
              />
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}

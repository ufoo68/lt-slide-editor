"use client";

import Link from "next/link";
import { LoadingBlock } from "@/components/LoadingBlock";
import { useLanguage } from "@/lib/i18n";

export type LibrarySlide = {
  id: string;
  title: string;
  markdown: string;
  updatedAt: string;
};

type SharedSlidesDrawerProps = {
  error: string | null;
  isLoading: boolean;
  slides: LibrarySlide[];
  onClose: () => void;
  onCopySlide: (slide: LibrarySlide) => void;
  onInsertSlide: (slide: LibrarySlide) => void;
};

export function SharedSlidesDrawer({
  error,
  isLoading,
  slides,
  onClose,
  onCopySlide,
  onInsertSlide,
}: SharedSlidesDrawerProps) {
  const { t } = useLanguage();

  return (
    <div className="fixed inset-0 z-40">
      <button
        aria-label={t.closeSharedSlides}
        className="absolute inset-0 bg-black/20"
        onClick={onClose}
        type="button"
      />
      <aside className="absolute right-0 top-0 grid h-full w-full max-w-md content-start gap-4 overflow-y-auto border-l border-line bg-paper p-5 shadow-panel">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black">{t.sharedSlidesTab}</h2>
          <button className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold" onClick={onClose} type="button">
            {t.close}
          </button>
        </div>
        <Link className="rounded-md bg-mint px-4 py-3 text-center text-sm font-semibold text-white" href="/shared-slides/new">
          {t.createSharedSlide}
        </Link>
        {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        <div className="grid gap-2">
          {isLoading ? <LoadingBlock label={t.sharedSlidesLoading} /> : null}
          {!isLoading && slides.length ? (
            slides.map((slide) => (
              <article className="rounded-md border border-line bg-white p-3" key={slide.id}>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-black">{slide.title}</h3>
                  <p className="mt-1 text-xs text-stone-600">{slide.markdown.split("\n").slice(0, 2).join(" ").slice(0, 120)}</p>
                </div>
                <button
                  className="mt-3 h-9 w-full rounded-md bg-mint px-3 text-sm font-semibold text-white"
                  onClick={() => onInsertSlide(slide)}
                  type="button"
                >
                  {t.addToNextPage}
                </button>
                <button
                  className="mt-2 h-9 w-full rounded-md border border-line bg-white px-3 text-sm font-semibold"
                  onClick={() => onCopySlide(slide)}
                  type="button"
                >
                  {t.copyMarkdown}
                </button>
              </article>
            ))
          ) : !isLoading ? (
            <div className="rounded-md border border-dashed border-line bg-white p-4">
              <p className="text-sm text-stone-600">{t.noSharedSlides}</p>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { renderSlides } from "@/lib/markdown";

export function SlidePreview({ markdown }: { markdown: string }) {
  const slides = useMemo(() => renderSlides(markdown), [markdown]);
  const [active, setActive] = useState(0);
  const current = slides[Math.min(active, Math.max(slides.length - 1, 0))];

  if (!current) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-lg border border-line bg-white text-sm text-stone-500">
        Markdownを書くとプレビューされます
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="aspect-video overflow-hidden rounded-lg border border-line bg-white shadow-panel">
        <article
          className="slide-content flex h-full flex-col justify-center p-8"
          dangerouslySetInnerHTML={{ __html: current.html }}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <button
          className="h-10 rounded-md border border-line px-3 text-sm font-semibold disabled:opacity-40"
          disabled={active === 0}
          onClick={() => setActive((value) => Math.max(0, value - 1))}
          type="button"
        >
          前へ
        </button>
        <span className="text-sm font-semibold text-stone-600">
          {current.index + 1} / {slides.length}
        </span>
        <button
          className="h-10 rounded-md border border-line px-3 text-sm font-semibold disabled:opacity-40"
          disabled={active >= slides.length - 1}
          onClick={() => setActive((value) => Math.min(slides.length - 1, value + 1))}
          type="button"
        >
          次へ
        </button>
      </div>
    </div>
  );
}

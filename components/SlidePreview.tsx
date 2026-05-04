"use client";

import { useMemo, useState } from "react";
import { renderSlides } from "@/lib/markdown";
import { SlideContent } from "@/components/SlideContent";

type SlidePreviewProps = {
  activeIndex?: number;
  markdown: string;
  onActiveIndexChange?: (index: number) => void;
};

export function SlidePreview({ activeIndex, markdown, onActiveIndexChange }: SlidePreviewProps) {
  const slides = useMemo(() => renderSlides(markdown), [markdown]);
  const [internalActive, setInternalActive] = useState(0);
  const active = activeIndex ?? internalActive;
  const current = slides[Math.min(active, Math.max(slides.length - 1, 0))];

  function setActive(index: number) {
    const nextIndex = Math.min(Math.max(index, 0), Math.max(slides.length - 1, 0));
    if (onActiveIndexChange) {
      onActiveIndexChange(nextIndex);
      return;
    }
    setInternalActive(nextIndex);
  }

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
        <SlideContent
          className="slide-content flex h-full flex-col justify-center p-8"
          html={current.html}
          key={`${current.index}-${current.html}`}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <button
          className="h-10 rounded-md border border-line px-3 text-sm font-semibold disabled:opacity-40"
          disabled={active === 0}
          onClick={() => setActive(active - 1)}
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
          onClick={() => setActive(active + 1)}
          type="button"
        >
          次へ
        </button>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { renderSlides } from "@/lib/markdown";
import { SlideContent } from "@/components/SlideContent";

type SlidePreviewProps = {
  activeIndex?: number;
  editableImages?: boolean;
  markdown: string;
  onActiveIndexChange?: (index: number) => void;
  onActiveSlideMarkdownChange?: (markdown: string) => void;
};

type ImageLayout = {
  h: number;
  w: number;
  x: number;
  y: number;
};

type ImageDragState = {
  corner: ImageResizeCorner | null;
  containerRect: DOMRect;
  image: HTMLImageElement;
  imageIndex: number;
  mode: "move" | "resize";
  pointerId: number;
  startLayout: ImageLayout;
  startX: number;
  startY: number;
};

type ImageResizeCorner = "nw" | "ne" | "sw" | "se";

const imageMarkdownPattern = /!\[([^\]]*)\]\((\S+?)(?:\s+"([^"]*)")?\)/g;
const resizeCornerClasses = ["is-resize-nw", "is-resize-ne", "is-resize-sw", "is-resize-se"];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatPercent(value: number) {
  return Number(value.toFixed(2));
}

function parseLayout(value: string | null): ImageLayout {
  const pairs = Object.fromEntries(
    (value ?? "")
      .split(";")
      .map((part) => part.split("="))
      .filter(([key, nextValue]) => key && nextValue)
  );
  const x = Number(pairs.x);
  const y = Number(pairs.y);
  const w = Number(pairs.w);
  const h = Number(pairs.h);

  return {
    h: Number.isFinite(h) ? h : 34,
    w: Number.isFinite(w) ? w : 42,
    x: Number.isFinite(x) ? x : 29,
    y: Number.isFinite(y) ? y : 33,
  };
}

function applyImageLayout(image: HTMLImageElement, layout: ImageLayout) {
  image.dataset.imageLayout = `x=${layout.x};y=${layout.y};w=${layout.w};h=${layout.h}`;
  image.style.left = `${layout.x}%`;
  image.style.top = `${layout.y}%`;
  image.style.width = `${layout.w}%`;
  image.style.height = `${layout.h}%`;
}

function imageResizeCorner(event: PointerEvent<HTMLDivElement>, image: HTMLImageElement): ImageResizeCorner | null {
  const rect = image.getBoundingClientRect();
  const cornerSize = 18;
  const nearLeft = event.clientX <= rect.left + cornerSize;
  const nearRight = event.clientX >= rect.right - cornerSize;
  const nearTop = event.clientY <= rect.top + cornerSize;
  const nearBottom = event.clientY >= rect.bottom - cornerSize;

  if (nearLeft && nearTop) return "nw";
  if (nearRight && nearTop) return "ne";
  if (nearLeft && nearBottom) return "sw";
  if (nearRight && nearBottom) return "se";
  return null;
}

function markResizeCorner(image: HTMLImageElement | null, corner: ImageResizeCorner | null) {
  image?.classList.remove(...resizeCornerClasses);
  if (image && corner) {
    image.classList.add(`is-resize-${corner}`);
  }
}

function updateMarkdownImageLayout(markdown: string, targetIndex: number, layout: ImageLayout) {
  let index = 0;
  return markdown.replace(imageMarkdownPattern, (match, alt: string, src: string, title: string | undefined) => {
    if (index !== targetIndex) {
      index += 1;
      return match;
    }

    index += 1;
    const cleanTitle = (title ?? "").replace(/\s*\blt-image:[^\s"]+/g, "").trim();
    const layoutTitle = `lt-image:x=${layout.x};y=${layout.y};w=${layout.w};h=${layout.h}`;
    const nextTitle = cleanTitle ? `${cleanTitle} ${layoutTitle}` : layoutTitle;
    return `![${alt}](${src} "${nextTitle}")`;
  });
}

export function SlidePreview({ activeIndex, editableImages = false, markdown, onActiveIndexChange, onActiveSlideMarkdownChange }: SlidePreviewProps) {
  const slides = useMemo(() => renderSlides(markdown), [markdown]);
  const [internalActive, setInternalActive] = useState(0);
  const dragRef = useRef<ImageDragState | null>(null);
  const hoverImageRef = useRef<HTMLImageElement | null>(null);
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

  function startImageDrag(event: PointerEvent<HTMLDivElement>) {
    if (!editableImages || !onActiveSlideMarkdownChange) {
      return;
    }

    const image = (event.target as HTMLElement).closest<HTMLImageElement>("img.slide-image-absolute");
    if (!image) {
      return;
    }

    const container = event.currentTarget.querySelector<HTMLElement>(".slide-content");
    if (!container) {
      return;
    }

    event.preventDefault();
    const corner = imageResizeCorner(event, image);
    const startLayout = parseLayout(image.dataset.imageLayout ?? null);
    image.classList.add("is-editable");
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      corner,
      containerRect: container.getBoundingClientRect(),
      image,
      imageIndex: Number(image.dataset.slideImageIndex ?? 0),
      mode: corner ? "resize" : "move",
      pointerId: event.pointerId,
      startLayout,
      startX: event.clientX,
      startY: event.clientY,
    };
  }

  function moveImage(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = ((event.clientX - drag.startX) / drag.containerRect.width) * 100;
    const deltaY = ((event.clientY - drag.startY) / drag.containerRect.height) * 100;
    const nextLayout =
      drag.mode === "resize"
        ? resizeImageLayout(drag, deltaX, deltaY)
        : {
            ...drag.startLayout,
            x: formatPercent(clamp(drag.startLayout.x + deltaX, 0, 100 - drag.startLayout.w)),
            y: formatPercent(clamp(drag.startLayout.y + deltaY, 0, 100 - drag.startLayout.h)),
          };

    applyImageLayout(drag.image, nextLayout);
  }

  function resizeImageLayout(drag: ImageDragState, deltaX: number, deltaY: number): ImageLayout {
    const { h, w, x, y } = drag.startLayout;

    switch (drag.corner) {
      case "nw": {
        const nextX = clamp(x + deltaX, 0, x + w - 5);
        const nextY = clamp(y + deltaY, 0, y + h - 5);
        return {
          h: formatPercent(h + y - nextY),
          w: formatPercent(w + x - nextX),
          x: formatPercent(nextX),
          y: formatPercent(nextY),
        };
      }
      case "ne": {
        const nextY = clamp(y + deltaY, 0, y + h - 5);
        return {
          h: formatPercent(h + y - nextY),
          w: formatPercent(clamp(w + deltaX, 5, 100 - x)),
          x,
          y: formatPercent(nextY),
        };
      }
      case "sw": {
        const nextX = clamp(x + deltaX, 0, x + w - 5);
        return {
          h: formatPercent(clamp(h + deltaY, 5, 100 - y)),
          w: formatPercent(w + x - nextX),
          x: formatPercent(nextX),
          y,
        };
      }
      case "se":
      default:
        return {
          ...drag.startLayout,
          h: formatPercent(clamp(h + deltaY, 5, 100 - y)),
          w: formatPercent(clamp(w + deltaX, 5, 100 - x)),
        };
    }
  }

  function finishImageDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !current || !onActiveSlideMarkdownChange) {
      return;
    }

    const nextLayout = parseLayout(drag.image.dataset.imageLayout ?? null);
    drag.image.classList.remove("is-editable");
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    onActiveSlideMarkdownChange(updateMarkdownImageLayout(current.markdown, drag.imageIndex, nextLayout));
  }

  function updateImageHover(event: PointerEvent<HTMLDivElement>) {
    if (!editableImages || dragRef.current) {
      return;
    }

    const image = (event.target as HTMLElement).closest<HTMLImageElement>("img.slide-image-absolute");
    if (hoverImageRef.current && hoverImageRef.current !== image) {
      markResizeCorner(hoverImageRef.current, null);
    }

    hoverImageRef.current = image;
    markResizeCorner(image, image ? imageResizeCorner(event, image) : null);
  }

  function clearImageHover() {
    markResizeCorner(hoverImageRef.current, null);
    hoverImageRef.current = null;
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
      <div
        className="aspect-video overflow-hidden rounded-lg border border-line bg-white shadow-panel"
        onPointerCancel={finishImageDrag}
        onPointerDown={startImageDrag}
        onPointerLeave={clearImageHover}
        onPointerMove={(event) => {
          moveImage(event);
          updateImageHover(event);
        }}
        onPointerUp={finishImageDrag}
      >
        <SlideContent
          className={`slide-content flex h-full flex-col justify-center p-8 ${editableImages ? "slide-content-editable" : ""}`}
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

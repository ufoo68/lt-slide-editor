"use client";

import { useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { parseDeckMarkdown, renderSlides, slideThemeClasses } from "@/lib/markdown";
import { SlideContent } from "@/components/SlideContent";
import { useLanguage } from "@/lib/i18n";

type SlidePreviewProps = {
  activeIndex?: number;
  compact?: boolean;
  editableMedia?: boolean;
  hideControls?: boolean;
  markdown: string;
  onActiveIndexChange?: (index: number) => void;
  onActiveSlideMarkdownChange?: (markdown: string) => void;
};

type MediaLayout = {
  h: number;
  w: number;
  x: number;
  y: number;
};

type MediaDragState = {
  corner: MediaResizeCorner | null;
  containerRect: DOMRect;
  media: HTMLElement;
  mediaIndex: number;
  mode: "move" | "resize";
  pointerId: number;
  startLayout: MediaLayout;
  startX: number;
  startY: number;
};

type MediaResizeCorner = "nw" | "ne" | "sw" | "se";

const mediaMarkdownPattern = /<video\b[^>]*>[\s\S]*?<\/video>|<img\b[^>]*>|!\[([^\]]*)\]\((\S+?)(?:\s+"([^"]*)")?\)/g;
const resizeCornerClasses = ["is-resize-nw", "is-resize-ne", "is-resize-sw", "is-resize-se"];
const editableMediaSelector = "img.slide-media-absolute, video.slide-media-absolute";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatPercent(value: number) {
  return Number(value.toFixed(2));
}

function escapeAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function mediaStyle(layout: MediaLayout) {
  return `position:absolute;left:${layout.x}%;top:${layout.y}%;width:${layout.w}%;height:${layout.h}%;object-fit:contain;`;
}

function parseLayout(value: string | null): MediaLayout {
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

function applyMediaLayout(media: HTMLElement, layout: MediaLayout) {
  media.dataset.mediaLayout = `x=${layout.x};y=${layout.y};w=${layout.w};h=${layout.h}`;
  media.style.left = `${layout.x}%`;
  media.style.top = `${layout.y}%`;
  media.style.width = `${layout.w}%`;
  media.style.height = `${layout.h}%`;
}

function mediaResizeCorner(event: PointerEvent<HTMLDivElement>, media: HTMLElement): MediaResizeCorner | null {
  const rect = media.getBoundingClientRect();
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

function markResizeCorner(media: HTMLElement | null, corner: MediaResizeCorner | null) {
  media?.classList.remove(...resizeCornerClasses);
  if (media && corner) {
    media.classList.add(`is-resize-${corner}`);
  }
}

function updateMarkdownMediaLayout(markdown: string, targetIndex: number, layout: MediaLayout) {
  let index = 0;
  return markdown.replace(mediaMarkdownPattern, (match, alt: string, src: string, title: string | undefined) => {
    if (index !== targetIndex) {
      index += 1;
      return match;
    }

    index += 1;
    if (match.startsWith("<img")) {
      const nextStyle = `style="${mediaStyle(layout)}"`;
      if (/\sstyle=(?:"[^"]*"|'[^']*')/i.test(match)) {
        return match.replace(/\sstyle=(?:"[^"]*"|'[^']*')/i, ` ${nextStyle}`);
      }
      return match.replace(/\s*\/?>$/, ` ${nextStyle}>`);
    }
    if (match.startsWith("<video")) {
      const nextStyle = `style="${mediaStyle(layout)}"`;
      return match.replace(/<video\b[^>]*>/i, (openingTag) => {
        if (/\sstyle=(?:"[^"]*"|'[^']*')/i.test(openingTag)) {
          return openingTag.replace(/\sstyle=(?:"[^"]*"|'[^']*')/i, ` ${nextStyle}`);
        }
        return openingTag.replace(/>$/, ` ${nextStyle}>`);
      });
    }

    return `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}" style="${mediaStyle(layout)}">`;
  });
}

export function SlidePreview({ activeIndex, compact = false, editableMedia = false, hideControls = false, markdown, onActiveIndexChange, onActiveSlideMarkdownChange }: SlidePreviewProps) {
  const { t } = useLanguage();
  const slides = useMemo(() => renderSlides(markdown), [markdown]);
  const settings = useMemo(() => parseDeckMarkdown(markdown).settings, [markdown]);
  const themeClasses = slideThemeClasses(settings.theme);
  const [internalActive, setInternalActive] = useState(0);
  const dragRef = useRef<MediaDragState | null>(null);
  const hoverMediaRef = useRef<HTMLElement | null>(null);
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

  function startMediaDrag(event: PointerEvent<HTMLDivElement>) {
    if (!editableMedia || !onActiveSlideMarkdownChange) {
      return;
    }

    const media = (event.target as HTMLElement).closest<HTMLElement>(editableMediaSelector);
    if (!media) {
      return;
    }

    const container = event.currentTarget.querySelector<HTMLElement>(".slide-content");
    if (!container) {
      return;
    }

    event.preventDefault();
    const corner = mediaResizeCorner(event, media);
    const startLayout = parseLayout(media.dataset.mediaLayout ?? null);
    media.classList.add("is-editable");
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      corner,
      containerRect: container.getBoundingClientRect(),
      media,
      mediaIndex: Number(media.dataset.slideMediaIndex ?? 0),
      mode: corner ? "resize" : "move",
      pointerId: event.pointerId,
      startLayout,
      startX: event.clientX,
      startY: event.clientY,
    };
  }

  function moveMedia(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = ((event.clientX - drag.startX) / drag.containerRect.width) * 100;
    const deltaY = ((event.clientY - drag.startY) / drag.containerRect.height) * 100;
    const nextLayout =
      drag.mode === "resize"
        ? resizeMediaLayout(drag, deltaX, deltaY)
        : {
            ...drag.startLayout,
            x: formatPercent(clamp(drag.startLayout.x + deltaX, 0, 100 - drag.startLayout.w)),
            y: formatPercent(clamp(drag.startLayout.y + deltaY, 0, 100 - drag.startLayout.h)),
          };

    applyMediaLayout(drag.media, nextLayout);
  }

  function resizeMediaLayout(drag: MediaDragState, deltaX: number, deltaY: number): MediaLayout {
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

  function finishMediaDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !current || !onActiveSlideMarkdownChange) {
      return;
    }

    const nextLayout = parseLayout(drag.media.dataset.mediaLayout ?? null);
    drag.media.classList.remove("is-editable");
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    onActiveSlideMarkdownChange(updateMarkdownMediaLayout(current.markdown, drag.mediaIndex, nextLayout));
  }

  function updateMediaHover(event: PointerEvent<HTMLDivElement>) {
    if (!editableMedia || dragRef.current) {
      return;
    }

    const media = (event.target as HTMLElement).closest<HTMLElement>(editableMediaSelector);
    if (hoverMediaRef.current && hoverMediaRef.current !== media) {
      markResizeCorner(hoverMediaRef.current, null);
    }

    hoverMediaRef.current = media;
    markResizeCorner(media, media ? mediaResizeCorner(event, media) : null);
  }

  function clearMediaHover() {
    markResizeCorner(hoverMediaRef.current, null);
    hoverMediaRef.current = null;
  }

  if (!current) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-lg border border-line bg-white text-sm text-stone-500">
        {t.markdownEmptyPreview}
      </div>
    );
  }

  return (
    <div className={compact ? "grid gap-1.5" : "grid gap-3"}>
      <div
        className={`${compact ? "aspect-video max-h-[48dvh] w-full" : "aspect-video"} overflow-hidden rounded-lg border border-line shadow-panel ${themeClasses.slide}`}
        onPointerCancel={finishMediaDrag}
        onPointerDown={startMediaDrag}
        onPointerLeave={clearMediaHover}
        onPointerMove={(event) => {
          moveMedia(event);
          updateMediaHover(event);
        }}
        onPointerUp={finishMediaDrag}
      >
        <div className="relative h-full">
          {settings.header ? (
            <div className="pointer-events-none absolute left-4 right-4 top-3 z-10 truncate text-xs font-semibold opacity-60 sm:left-6 sm:right-6">
              {settings.header}
            </div>
          ) : null}
          <SlideContent
            className={`slide-content flex h-full flex-col justify-center ${compact ? "p-3 pt-7 pb-7 sm:p-4 sm:pt-8 sm:pb-8" : "p-4 pt-9 pb-9 sm:p-6 sm:pt-10 sm:pb-10 lg:p-8 lg:pt-12 lg:pb-12"} ${editableMedia ? "slide-content-editable" : ""}`}
            html={current.html}
            key={`${current.index}-${current.html}`}
          />
          {settings.footer ? (
            <div className="pointer-events-none absolute bottom-3 left-4 right-4 z-10 truncate text-xs font-semibold opacity-60 sm:left-6 sm:right-6">
              {settings.footer}
            </div>
          ) : null}
        </div>
      </div>
      {hideControls ? null : (
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
          <button
            className={`${compact ? "h-9" : "h-10"} rounded-md border border-line px-3 text-sm font-semibold disabled:opacity-40`}
            disabled={active === 0}
            onClick={() => setActive(active - 1)}
            type="button"
          >
            {t.previous}
          </button>
          <span className="px-2 text-center text-sm font-semibold text-stone-600">
            {current.index + 1} / {slides.length}
          </span>
          <button
            className={`${compact ? "h-9" : "h-10"} rounded-md border border-line px-3 text-sm font-semibold disabled:opacity-40`}
            disabled={active >= slides.length - 1}
            onClick={() => setActive(active + 1)}
            type="button"
          >
            {t.next}
          </button>
        </div>
      )}
    </div>
  );
}

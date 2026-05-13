"use client";

import { useState, type PointerEvent } from "react";
import { Button } from "ufoo-ui";
import { useLanguage } from "@/lib/i18n";

export type FactCheckSource = {
  title: string;
  url: string;
  note: string;
};

export type FactCheckReview = {
  selectedText: string;
  answer: string;
  sources: FactCheckSource[];
};

export type FactCheckPopupPosition = {
  left: number;
  top: number;
};

type FactCheckPopupProps = {
  background: string;
  factCheckText: string;
  isLoading: boolean;
  position: FactCheckPopupPosition | null;
  onBackgroundChange: (background: string) => void;
  onClose: () => void;
  onPositionChange: (position: FactCheckPopupPosition) => void;
  onRun: () => void;
};

type FactCheckAnswerPanelProps = {
  error: string | null;
  isLoading: boolean;
  isMinimized: boolean;
  review: FactCheckReview | null;
  onMinimizedChange: (isMinimized: boolean) => void;
};

export function FactCheckPopup({
  background,
  factCheckText,
  isLoading,
  position,
  onBackgroundChange,
  onClose,
  onPositionChange,
  onRun,
}: FactCheckPopupProps) {
  const { t } = useLanguage();
  const [dragOffset, setDragOffset] = useState<FactCheckPopupPosition | null>(null);

  if (!position || !factCheckText) return null;
  const currentPosition = position;

  function clampPosition(left: number, top: number) {
    if (typeof window === "undefined") {
      return { left, top };
    }

    const width = Math.min(384, window.innerWidth - 24);
    const height = 260;

    return {
      left: Math.min(Math.max(12, left), Math.max(12, window.innerWidth - width - 12)),
      top: Math.min(Math.max(12, top), Math.max(12, window.innerHeight - height - 12)),
    };
  }

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragOffset({
      left: event.clientX - currentPosition.left,
      top: event.clientY - currentPosition.top,
    });
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    if (!dragOffset) return;

    onPositionChange(clampPosition(
      event.clientX - dragOffset.left,
      event.clientY - dragOffset.top,
    ));
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (!dragOffset) return;

    event.currentTarget.releasePointerCapture(event.pointerId);
    setDragOffset(null);
  }

  return (
    <div
      className="fixed z-50 w-[calc(100vw-1.5rem)] max-w-sm rounded-lg border border-stone-300 bg-white p-3 shadow-2xl"
      style={{ left: currentPosition.left, top: currentPosition.top }}
    >
      <div className="absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rotate-45 border-b border-l border-stone-300 bg-white" />
      <div className="relative grid gap-2">
        <div
          className="flex cursor-move select-none items-center justify-between rounded-md bg-stone-100 px-2 py-1.5 text-xs font-black uppercase tracking-normal text-stone-700"
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <span>{t.aiReview}</span>
          <svg aria-hidden="true" className="h-4 w-4 text-stone-500" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="9" cy="7" r="1" />
            <circle cx="15" cy="7" r="1" />
            <circle cx="9" cy="12" r="1" />
            <circle cx="15" cy="12" r="1" />
            <circle cx="9" cy="17" r="1" />
            <circle cx="15" cy="17" r="1" />
          </svg>
        </div>
        <div className="max-h-20 overflow-y-auto rounded-md bg-stone-50 p-2 font-mono text-xs leading-5 text-stone-950">
          {factCheckText}
        </div>
        <label className="grid gap-1 text-xs font-bold text-stone-900">
          <span>{t.aiReviewBackground}</span>
          <textarea
            className="min-h-20 resize-y rounded-md border border-stone-400 bg-stone-50 p-2 text-sm font-medium leading-5 text-stone-800 outline-mint placeholder:text-stone-500"
            maxLength={5000}
            onChange={(event) => onBackgroundChange(event.target.value)}
            placeholder={t.aiReviewBackgroundPlaceholder}
            value={background}
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onPress={onClose}>
            {t.close}
          </Button>
          <Button isDisabled={isLoading} size="sm" variant="primary" onPress={onRun}>
            {isLoading ? t.aiReviewing : t.runAiReview}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function FactCheckAnswerPanel({
  error,
  isLoading,
  isMinimized,
  review,
  onMinimizedChange,
}: FactCheckAnswerPanelProps) {
  const { t } = useLanguage();

  return (
    <aside className="fixed bottom-4 right-4 z-40 grid max-h-[min(34rem,calc(100dvh-2rem))] w-[calc(100vw-2rem)] max-w-lg gap-3 overflow-y-auto rounded-lg border border-sky-200 bg-white p-4 shadow-2xl">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-black uppercase tracking-normal text-stone-700">{t.aiReview}</h2>
        <Button
          aria-label={isMinimized ? t.aiReviewExpand : t.aiReviewMinimize}
          className="h-8 w-8 min-w-8 px-0"
          size="sm"
          variant="outline"
          onPress={() => onMinimizedChange(!isMinimized)}
        >
          <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
            {isMinimized ? (
              <>
                <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                <path d="M16 3h3a2 2 0 0 1 2 2v3" />
                <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
                <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
              </>
            ) : (
              <path d="M5 12h14" />
            )}
          </svg>
        </Button>
      </div>
      {!isMinimized && isLoading ? <p className="rounded-md bg-sky-50 p-3 text-sm font-semibold text-sky-950">{t.aiReviewing}</p> : null}
      {!isMinimized && error ? <p className="rounded-md bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p> : null}
      {!isMinimized && review ? (
        <>
          <div className="rounded-md bg-sky-50 p-3 text-sm text-sky-950">
            <p className="whitespace-pre-wrap font-semibold leading-6">{review.answer}</p>
          </div>
          {review.sources.length ? (
            <div className="grid gap-2">
              <h3 className="text-xs font-black uppercase tracking-normal text-stone-700">{t.aiReviewSources}</h3>
              <ul className="grid gap-2">
                {review.sources.map((source) => (
                  <li className="rounded-md border border-line bg-white p-3 text-sm" key={source.url}>
                    <a className="font-semibold text-sky-800 underline-offset-2 hover:underline" href={source.url} rel="noreferrer" target="_blank">
                      {source.title}
                    </a>
                    <p className="mt-1 break-all text-xs font-medium text-stone-700">{source.url}</p>
                    <p className="mt-2 leading-6 text-stone-900">{source.note}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
      {!isMinimized && !isLoading && !error && !review ? (
        <p className="rounded-md bg-stone-50 p-3 text-sm font-medium leading-6 text-stone-700">{t.aiReviewEmpty}</p>
      ) : null}
    </aside>
  );
}

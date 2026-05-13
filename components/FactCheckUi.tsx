"use client";

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
  onRun,
}: FactCheckPopupProps) {
  const { t } = useLanguage();

  if (!position || !factCheckText) return null;

  return (
    <div
      className="fixed z-50 w-[calc(100vw-1.5rem)] max-w-sm rounded-lg border border-stone-300 bg-white p-3 shadow-2xl"
      style={{ left: position.left, top: position.top }}
    >
      <div className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-l border-t border-stone-300 bg-white" />
      <div className="relative grid gap-2">
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

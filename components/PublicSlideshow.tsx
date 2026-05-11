"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SlideContent } from "@/components/SlideContent";
import { useLanguage } from "@/lib/i18n";

type PublicSlide = {
  index: number;
  html: string;
};

type PublicSlideshowProps = {
  initialActive?: number;
  onClose?: () => void;
  presentationMinutes?: number;
  title: string;
  updatedAt: string;
  slides: PublicSlide[];
};

function clampSlideIndex(value: number, slideCount: number) {
  return Math.min(Math.max(value, 0), Math.max(slideCount - 1, 0));
}

function formatRemainingTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function PublicSlideshow({
  initialActive = 0,
  onClose,
  presentationMinutes = 5,
  title,
  updatedAt,
  slides,
}: PublicSlideshowProps) {
  const { t } = useLanguage();
  const [active, setActive] = useState(() => clampSlideIndex(initialActive, slides.length));
  const [isFullscreen, setIsFullscreen] = useState(false);
  const totalSeconds = Math.max(1, Math.round(presentationMinutes)) * 60;
  const [remainingSeconds, setRemainingSeconds] = useState(totalSeconds);
  const [timerEndsAt, setTimerEndsAt] = useState<number | null>(null);
  const current = slides[Math.min(active, Math.max(slides.length - 1, 0))];
  const timerRunning = timerEndsAt !== null;
  const displayedRemainingSeconds = timerRunning || remainingSeconds === 0 ? remainingSeconds : totalSeconds;
  const progress = useMemo(() => {
    if (!slides.length) {
      return 0;
    }

    return ((active + 1) / slides.length) * 100;
  }, [active, slides.length]);

  const goNext = useCallback(() => {
    setActive((value) => Math.min(slides.length - 1, value + 1));
  }, [slides.length]);

  const goPrevious = useCallback(() => {
    setActive((value) => Math.max(0, value - 1));
  }, []);

  const startTimer = useCallback(() => {
    setRemainingSeconds(totalSeconds);
    setTimerEndsAt(Date.now() + totalSeconds * 1000);
  }, [totalSeconds]);

  const resetTimer = useCallback(() => {
    setTimerEndsAt(null);
    setRemainingSeconds(totalSeconds);
  }, [totalSeconds]);

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      return;
    }

    await document.exitFullscreen();
  }, []);

  useEffect(() => {
    if (timerEndsAt === null) {
      return;
    }

    const timerId = window.setInterval(() => {
      const nextRemainingSeconds = Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000));
      setRemainingSeconds(nextRemainingSeconds);
      if (nextRemainingSeconds === 0) {
        setTimerEndsAt(null);
      }
    }, 250);

    return () => window.clearInterval(timerId);
  }, [timerEndsAt]);

  const close = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
    onClose?.();
  }, [onClose]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && onClose) {
        event.preventDefault();
        close();
        return;
      }
      if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
        event.preventDefault();
        goNext();
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        goPrevious();
      }
      if (event.key === "Home") {
        event.preventDefault();
        setActive(0);
      }
      if (event.key === "End") {
        event.preventDefault();
        setActive(Math.max(slides.length - 1, 0));
      }
      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        toggleFullscreen();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, goNext, goPrevious, onClose, slides.length, toggleFullscreen]);

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  if (!current) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink px-4 text-white">
        <p className="text-lg font-semibold">{t.noPublicSlides}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-ink text-white">
      <div className="flex min-h-screen flex-col">
        <header className="flex min-h-16 flex-col gap-3 border-b border-white/10 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="min-w-0 self-stretch sm:self-auto">
            <h1 className="truncate text-lg font-black">{title}</h1>
            <p className="text-xs font-semibold text-white/55">{t.updatedLabel} {updatedAt}</p>
          </div>
          <div className="grid grid-cols-4 items-center gap-2 sm:flex">
            <div
              className={`col-span-4 flex h-10 items-center justify-between gap-2 rounded-md border px-3 text-sm font-bold sm:col-span-1 sm:justify-start ${
                displayedRemainingSeconds === 0 ? "border-coral bg-coral text-white" : "border-white/20"
              }`}
            >
              <span className="tabular-nums">{formatRemainingTime(displayedRemainingSeconds)}</span>
              <button
                className="rounded bg-white px-2 py-1 text-xs font-black text-ink"
                onClick={timerRunning ? resetTimer : startTimer}
                type="button"
              >
                {timerRunning ? t.resetTimer : t.startTimer}
              </button>
            </div>
            {onClose ? (
              <button className="h-10 rounded-md border border-white/20 px-3 text-sm font-bold" onClick={close} type="button">
                {t.close}
              </button>
            ) : null}
            <button
              aria-label={t.previousSlide}
              className="h-10 min-w-10 rounded-md border border-white/20 px-3 text-sm font-bold disabled:opacity-35"
              disabled={active === 0}
              onClick={goPrevious}
              type="button"
            >
              ←
            </button>
            <span className="min-w-12 text-center text-sm font-bold sm:min-w-16">
              {active + 1} / {slides.length}
            </span>
            <button
              aria-label={t.nextSlide}
              className="h-10 min-w-10 rounded-md border border-white/20 px-3 text-sm font-bold disabled:opacity-35"
              disabled={active >= slides.length - 1}
              onClick={goNext}
              type="button"
            >
              →
            </button>
            <button
              className="col-span-4 h-10 rounded-md bg-white px-3 text-sm font-bold text-ink sm:col-span-1"
              onClick={toggleFullscreen}
              type="button"
            >
              {isFullscreen ? t.exitFullscreen : t.fullscreen}
            </button>
          </div>
        </header>

        <div className="h-1 bg-white/10">
          <div className="h-full bg-coral transition-all" style={{ width: `${progress}%` }} />
        </div>

        <section className="flex flex-1 items-center justify-center px-4 py-5 sm:px-6 lg:px-10">
          <div className="w-full max-w-7xl">
            <div className="aspect-video overflow-hidden rounded-lg bg-white text-ink shadow-panel">
              <SlideContent
                className="slide-content flex h-full flex-col justify-center p-6 sm:p-10 lg:p-14"
                html={current.html}
                key={`${current.index}-${current.html}`}
              />
            </div>
          </div>
        </section>

        <footer className="flex min-h-12 items-center justify-center px-4 pb-4 text-xs font-semibold text-white/45">
          <span>← / → / Space / F</span>
        </footer>
      </div>
    </main>
  );
}

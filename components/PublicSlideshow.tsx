"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type PublicSlide = {
  index: number;
  html: string;
};

type PublicSlideshowProps = {
  title: string;
  updatedAt: string;
  slides: PublicSlide[];
};

export function PublicSlideshow({ title, updatedAt, slides }: PublicSlideshowProps) {
  const [active, setActive] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const current = slides[Math.min(active, Math.max(slides.length - 1, 0))];
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

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      return;
    }

    await document.exitFullscreen();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
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
  }, [goNext, goPrevious, slides.length, toggleFullscreen]);

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
        <p className="text-lg font-semibold">公開できるスライドがありません。</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-ink text-white">
      <div className="flex min-h-screen flex-col">
        <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-black">{title}</h1>
            <p className="text-xs font-semibold text-white/55">Updated {updatedAt}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              aria-label="前のスライド"
              className="h-10 min-w-10 rounded-md border border-white/20 px-3 text-sm font-bold disabled:opacity-35"
              disabled={active === 0}
              onClick={goPrevious}
              type="button"
            >
              ←
            </button>
            <span className="min-w-16 text-center text-sm font-bold">
              {active + 1} / {slides.length}
            </span>
            <button
              aria-label="次のスライド"
              className="h-10 min-w-10 rounded-md border border-white/20 px-3 text-sm font-bold disabled:opacity-35"
              disabled={active >= slides.length - 1}
              onClick={goNext}
              type="button"
            >
              →
            </button>
            <button
              className="h-10 rounded-md bg-white px-3 text-sm font-bold text-ink"
              onClick={toggleFullscreen}
              type="button"
            >
              {isFullscreen ? "Exit" : "Full"}
            </button>
          </div>
        </header>

        <div className="h-1 bg-white/10">
          <div className="h-full bg-coral transition-all" style={{ width: `${progress}%` }} />
        </div>

        <section className="flex flex-1 items-center justify-center px-4 py-5 sm:px-6 lg:px-10">
          <div className="w-full max-w-7xl">
            <div className="aspect-video overflow-hidden rounded-lg bg-white text-ink shadow-panel">
              <article
                className="slide-content flex h-full flex-col justify-center p-6 sm:p-10 lg:p-14"
                dangerouslySetInnerHTML={{ __html: current.html }}
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

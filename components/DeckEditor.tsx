"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Switch, Tabs } from "@heroui/react";
import { useAuth } from "@/components/AuthProvider";
import { Header } from "@/components/Header";
import { LoadingBlock } from "@/components/LoadingBlock";
import { PublicSlideshow } from "@/components/PublicSlideshow";
import { SlidePreview } from "@/components/SlidePreview";
import { joinEditableSlides, renderSlides, splitEditableSlides } from "@/lib/markdown";
import { insertTextareaTab } from "@/lib/textarea";
import { useLanguage } from "@/lib/i18n";

type Deck = {
  id: string;
  title: string;
  slug: string;
  markdown: string;
  presentationMinutes: number;
  visibility: "private" | "public";
  updatedAt: string;
};

type LibrarySlide = {
  id: string;
  title: string;
  markdown: string;
  updatedAt: string;
};

type MediaLibraryItem = {
  contentType: string;
  id: string;
  filename: string;
  markdown: string;
  size: number;
  updatedAt: string;
  url: string;
};

type DeckEditorProps = {
  mode: "new" | "edit";
};

type SavedDeckState = {
  markdown: string;
  presentationMinutes: number;
  title: string;
  visibility: "private" | "public";
};

type AiReviewSuggestion = {
  message: string;
  severity: "high" | "medium" | "low";
  slide?: number | null;
};

type AiReview = {
  summary: string;
  suggestions: AiReviewSuggestion[];
};

const initialMarkdown = `# 今日話すこと

- 背景
- 課題
- 解決策
- まとめ

---

# コード例

\`\`\`ts
const message = "Hello LT";
console.log(message);
\`\`\`

---

# システム構成図

\`\`\`mermaid
flowchart LR
  Browser[Browser] --> App[Next.js App]
  App --> DB[(PostgreSQL)]
  App --> Auth[Firebase Auth]
\`\`\`
`;

export function DeckEditor({ mode }: DeckEditorProps) {
  const params = useParams<{ id?: string }>();
  const router = useRouter();
  const { user, loading, token } = useAuth();
  const { language, t } = useLanguage();
  const initialSavedState = useMemo<SavedDeckState>(
    () => ({
      markdown: mode === "new" ? initialMarkdown : "",
      presentationMinutes: 5,
      title: mode === "new" ? "新しいLT" : "",
      visibility: "private",
    }),
    [mode],
  );
  const [deck, setDeck] = useState<Deck | null>(null);
  const [title, setTitle] = useState(mode === "new" ? "新しいLT" : "");
  const [markdown, setMarkdown] = useState(mode === "new" ? initialMarkdown : "");
  const [presentationMinutes, setPresentationMinutes] = useState(5);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [editMode, setEditMode] = useState<"page" | "full">("page");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [savedState, setSavedState] = useState<SavedDeckState>(initialSavedState);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deckLoading, setDeckLoading] = useState(mode === "edit");
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [presentationPreviewOpen, setPresentationPreviewOpen] = useState(false);
  const [media, setMedia] = useState<MediaLibraryItem[]>([]);
  const [librarySlides, setLibrarySlides] = useState<LibrarySlide[]>([]);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [aiReview, setAiReview] = useState<AiReview | null>(null);
  const [aiReviewError, setAiReviewError] = useState<string | null>(null);
  const [aiReviewLoading, setAiReviewLoading] = useState(false);
  const slides = useMemo(() => splitEditableSlides(markdown), [markdown]);
  const presentationSlides = useMemo(
    () => renderSlides(markdown).map((slide) => ({ index: slide.index, html: slide.html })),
    [markdown],
  );
  const slideCount = slides.length;
  const safeActiveSlideIndex = Math.min(activeSlideIndex, Math.max(slides.length - 1, 0));
  const activeSlideMarkdown = slides[safeActiveSlideIndex] ?? "";
  const hasUnsavedChanges =
    title !== savedState.title ||
    markdown !== savedState.markdown ||
    presentationMinutes !== savedState.presentationMinutes ||
    visibility !== savedState.visibility;

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, router, user]);

  useEffect(() => {
    async function load() {
      if (!user || mode !== "edit" || !params.id) return;
      setError(null);
      setDeckLoading(true);
      try {
        const idToken = await token();
        const response = await fetch(`/api/presentations/${params.id}`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!response.ok) {
          setError(t.deckLoadFailed);
          return;
        }
        const data = (await response.json()) as { deck: Deck };
        setDeck(data.deck);
        setTitle(data.deck.title);
        setMarkdown(data.deck.markdown);
        setPresentationMinutes(data.deck.presentationMinutes);
        setActiveSlideIndex(0);
        setVisibility(data.deck.visibility);
        setSavedState({
          markdown: data.deck.markdown,
          presentationMinutes: data.deck.presentationMinutes,
          title: data.deck.title,
          visibility: data.deck.visibility,
        });
      } catch {
        setError(t.deckLoadFailed);
      } finally {
        setDeckLoading(false);
      }
    }
    load();
  }, [mode, params.id, t, token, user]);

  useEffect(() => {
    async function loadLibrary() {
      if (!user || !libraryOpen || libraryLoaded) return;
      setLibraryError(null);
      setLibraryLoading(true);
      try {
        const idToken = await token();
        const response = await fetch("/api/shared-slides", {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!response.ok) {
          setLibraryError(t.libraryLoadFailed);
          return;
        }
        const data = (await response.json()) as { slides: LibrarySlide[] };
        setLibrarySlides(data.slides);
        setLibraryLoaded(true);
      } catch {
        setLibraryError(t.libraryLoadFailed);
      } finally {
        setLibraryLoading(false);
      }
    }
    loadLibrary();
  }, [libraryLoaded, libraryOpen, t, token, user]);

  useEffect(() => {
    async function loadMedia() {
      if (!user || !mediaOpen || mediaLoaded) return;
      setMediaError(null);
      setMediaLoading(true);
      try {
        const idToken = await token();
        const response = await fetch("/api/media", {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!response.ok) {
          setMediaError(t.mediaLibraryLoadFailed);
          return;
        }
        const data = (await response.json()) as { media: MediaLibraryItem[] };
        setMedia(data.media);
        setMediaLoaded(true);
      } catch {
        setMediaError(t.mediaLibraryLoadFailed);
      } finally {
        setMediaLoading(false);
      }
    }
    loadMedia();
  }, [mediaLoaded, mediaOpen, t, token, user]);

  async function copyLibrarySlide(slide: LibrarySlide) {
    setLibraryError(null);
    try {
      await navigator.clipboard.writeText(slide.markdown.trim());
      setStatus(t.copiedMarkdown(slide.title));
    } catch {
      setLibraryError(t.clipboardFailed);
    }
  }

  function insertLibrarySlideAfterCurrent(slide: LibrarySlide) {
    const nextSlides = [...slides];
    const insertIndex = safeActiveSlideIndex + 1;
    nextSlides.splice(insertIndex, 0, slide.markdown.trim());
    setMarkdown(joinEditableSlides(nextSlides));
    setActiveSlideIndex(insertIndex);
    setLibraryOpen(false);
    setStatus(t.insertedLibrarySlide(slide.title));
  }

  async function copyMediaMarkdown(item: MediaLibraryItem) {
    setMediaError(null);
    try {
      await navigator.clipboard.writeText(mediaMarkdownWithLayout(item));
      setStatus(t.copiedMarkdown(item.filename));
    } catch {
      setMediaError(t.clipboardFailed);
    }
  }

  function mediaMarkdownWithLayout(item: MediaLibraryItem) {
    return item.markdown;
  }

  function insertMedia(item: MediaLibraryItem) {
    const mediaMarkdown = mediaMarkdownWithLayout(item);
    const separator = activeSlideMarkdown.trim() ? "\n\n" : "";
    updateActiveSlide(`${activeSlideMarkdown}${separator}${mediaMarkdown}`);
    setMediaOpen(false);
    setStatus(t.insertedMediaCurrentPage(item.filename));
  }

  async function reviewWithAi() {
    setAiReviewLoading(true);
    setAiReviewError(null);
    try {
      const idToken = await token();
      const response = await fetch("/api/ai/review", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ language, markdown, presentationMinutes, title }),
      });
      const data = (await response.json()) as { review?: AiReview; error?: string };
      if (!response.ok || !data.review) {
        if (response.status === 503) {
          throw new Error(t.aiReviewNotConfigured);
        }
        throw new Error(data.error || t.aiReviewFailed);
      }
      setAiReview(data.review);
    } catch (err) {
      setAiReviewError(err instanceof Error ? err.message : t.aiReviewFailed);
    } finally {
      setAiReviewLoading(false);
    }
  }

  async function uploadAndInsertMedia(file: File | null) {
    if (!file) return;
    setUploadingMedia(true);
    setMediaError(null);
    try {
      const idToken = await token();
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch("/api/media", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
        body: formData,
      });
      if (!response.ok) {
        throw new Error(t.mediaUploadFailed);
      }
      const data = (await response.json()) as { media: MediaLibraryItem };
      setMedia((currentMedia) => [data.media, ...currentMedia]);
      setMediaLoaded(true);
      insertMedia(data.media);
    } catch (err) {
      setMediaError(err instanceof Error ? err.message : t.mediaUploadFailed);
    } finally {
      setUploadingMedia(false);
    }
  }

  function updateActiveSlide(nextMarkdown: string) {
    const nextSlides = [...slides];
    nextSlides[safeActiveSlideIndex] = nextMarkdown;
    setMarkdown(joinEditableSlides(nextSlides));
  }

  function goPreviousSlide() {
    setActiveSlideIndex((index) => Math.max(0, index - 1));
  }

  function goNextSlide() {
    if (safeActiveSlideIndex < slides.length - 1) {
      setActiveSlideIndex((index) => index + 1);
      return;
    }

    const nextSlides = [...slides, ""];
    setMarkdown(joinEditableSlides(nextSlides));
    setActiveSlideIndex(nextSlides.length - 1);
  }

  function deleteActiveSlide() {
    if (slides.length <= 1) {
      setMarkdown("");
      setActiveSlideIndex(0);
      return;
    }

    const nextSlides = slides.filter((_, index) => index !== safeActiveSlideIndex);
    setMarkdown(joinEditableSlides(nextSlides));
    setActiveSlideIndex((index) => Math.min(index, nextSlides.length - 1));
  }

  async function save() {
    setBusy(true);
    setStatus(t.saving);
    setError(null);
    try {
      const normalizedSlides = [...slides];
      while (normalizedSlides.length > 1 && !normalizedSlides.at(-1)?.trim()) {
        normalizedSlides.pop();
      }
      const normalizedMarkdown = joinEditableSlides(normalizedSlides);
      const removedEmptySlideCount = slides.length - normalizedSlides.length;
      const nextActiveSlideIndex = Math.min(safeActiveSlideIndex, Math.max(normalizedSlides.length - 1, 0));
      const idToken = await token();
      const response = await fetch(mode === "new" ? "/api/presentations" : `/api/presentations/${params.id}`, {
        method: mode === "new" ? "POST" : "PUT",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title, markdown: normalizedMarkdown, presentationMinutes, visibility }),
      });
      if (!response.ok) {
        throw new Error(t.saveFailed);
      }
      const data = (await response.json()) as { deck: Deck };
      setDeck(data.deck);
      setMarkdown(data.deck.markdown);
      setActiveSlideIndex(nextActiveSlideIndex);
      setSavedState({
        markdown: data.deck.markdown,
        presentationMinutes: data.deck.presentationMinutes,
        title: data.deck.title,
        visibility: data.deck.visibility,
      });
      setStatus(removedEmptySlideCount ? t.savedRemovedEmpty(removedEmptySlideCount) : t.saved);
      if (mode === "new") {
        router.replace(`/presentations/${data.deck.id}/edit`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.saveFailed);
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user || deckLoading) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-4xl px-4 py-8">
          <LoadingBlock label={deckLoading ? t.deckLoading : t.authChecking} />
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="mx-auto flex h-[calc(100dvh-4rem-1px)] max-w-7xl flex-col gap-4 overflow-hidden px-4 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <Link className="text-sm font-semibold text-primary" href="/dashboard">
              {t.dashboard}
            </Link>
            <input
              className="mt-1 block w-full min-w-[18rem] bg-transparent text-2xl font-black outline-none"
              onChange={(event) => setTitle(event.target.value)}
              value={title}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {deck?.visibility === "public" ? (
              <Link href={`/view/${deck.slug}`} target="_blank">
                <Button size="sm" variant="outline">{t.openPublicUrl}</Button>
              </Link>
            ) : null}
            <label className="flex h-10 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-semibold">
              {t.presentationTime}
              <input
                className="h-8 w-16 bg-transparent text-right outline-none"
                max={180}
                min={1}
                onChange={(event) => setPresentationMinutes(Math.max(1, Math.min(180, Number(event.target.value) || 1)))}
                type="number"
                value={presentationMinutes}
              />
              {t.minutesUnit}
            </label>
            <Switch
              className="flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold"
              isSelected={visibility === "public"}
              size="sm"
              onChange={(selected) => setVisibility(selected ? "public" : "private")}
            >
              <Switch.Control
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  visibility === "public" ? "bg-mint" : "bg-stone-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 block h-4 w-4 rounded-full bg-white shadow transition-[left] ${
                    visibility === "public" ? "left-[18px]" : "left-0.5"
                  }`}
                />
              </Switch.Control>
              {t.public}
            </Switch>
            <Button variant="outline" onPress={() => setMediaOpen(true)}>
              {t.mediaTab}
            </Button>
            <Button variant="outline" onPress={() => setLibraryOpen(true)}>
              {t.sharedSlidesTab}
            </Button>
            <Button
              isDisabled={busy || !title.trim() || !hasUnsavedChanges}
              variant="primary"
              onPress={save}
            >
              {t.save}
            </Button>
          </div>
        </div>

        {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {status ? <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{status}</p> : null}

        <section className="grid min-h-0 flex-1 items-start gap-4 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_minmax(24rem,1fr)] lg:items-stretch lg:overflow-hidden">
          <div className="flex min-h-0 flex-col gap-3 lg:h-full">
            <div className="flex items-center justify-between">
              <h1 className="text-sm font-black uppercase tracking-normal text-stone-600">Markdown</h1>
              <span className="text-sm font-semibold text-stone-600">
                {editMode === "page" ? `${safeActiveSlideIndex + 1} / ${slideCount}` : `${slideCount} ${language === "ja" ? "slides" : "slides"}`}
              </span>
            </div>
            <Tabs
              aria-label={t.pageEdit}
              selectedKey={editMode}
              onSelectionChange={(key) => setEditMode(key === "full" ? "full" : "page")}
            >
              <Tabs.List className="rounded-md border border-line bg-white p-1">
                <Tabs.Tab className="rounded px-3 py-2 text-sm font-semibold data-[selected=true]:bg-ink data-[selected=true]:text-white" id="page">
                  {t.pageEdit}
                </Tabs.Tab>
                <Tabs.Tab className="rounded px-3 py-2 text-sm font-semibold data-[selected=true]:bg-ink data-[selected=true]:text-white" id="full">
                  {t.fullMarkdown}
                </Tabs.Tab>
              </Tabs.List>
            </Tabs>
            {editMode === "page" ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-2">
                  <Button
                    isDisabled={safeActiveSlideIndex === 0}
                    size="sm"
                    variant="outline"
                    onPress={goPreviousSlide}
                  >
                    {t.previousPage}
                  </Button>
                  <Button
                    isDisabled={!activeSlideMarkdown.trim()}
                    size="sm"
                    variant="outline"
                    onPress={goNextSlide}
                  >
                    {t.nextPage}
                  </Button>
                </div>
                <Button size="sm" variant="outline" onPress={deleteActiveSlide}>
                  {t.deletePage}
                </Button>
              </div>
            ) : null}
            {editMode === "page" ? (
              <textarea
                className="min-h-[24rem] resize-none rounded-lg border border-line bg-[#fffdf8] p-4 font-mono text-sm leading-6 outline-mint lg:min-h-0 lg:flex-1"
                onKeyDown={(event) => insertTextareaTab(event, updateActiveSlide)}
                onChange={(event) => updateActiveSlide(event.target.value)}
                spellCheck={false}
                value={activeSlideMarkdown}
              />
            ) : (
              <textarea
                className="min-h-[24rem] resize-none rounded-lg border border-line bg-[#fffdf8] p-4 font-mono text-sm leading-6 outline-mint lg:min-h-0 lg:flex-1"
                onKeyDown={(event) => insertTextareaTab(event, setMarkdown)}
                onChange={(event) => setMarkdown(event.target.value)}
                spellCheck={false}
                value={markdown}
              />
            )}
          </div>
          <aside className="grid min-h-0 gap-4 lg:h-full lg:grid-rows-[auto_minmax(0,1fr)]">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-normal text-stone-600">{t.preview}</h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-stone-600">{t.slidePage}: {safeActiveSlideIndex + 1}</span>
                  <Button size="sm" variant="outline" onPress={() => setPresentationPreviewOpen(true)}>
                    {t.presentationView}
                  </Button>
                </div>
              </div>
              <SlidePreview
                activeIndex={safeActiveSlideIndex}
                editableMedia={editMode === "page"}
                markdown={markdown}
                onActiveIndexChange={setActiveSlideIndex}
                onActiveSlideMarkdownChange={updateActiveSlide}
              />
            </div>
            <Card className="min-h-0 overflow-hidden border border-line bg-white/90 shadow-panel">
              <Card.Content className="flex h-full min-h-0 flex-col">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-black uppercase tracking-normal text-stone-600">{t.aiReview}</h2>
                  <Button
                    isDisabled={aiReviewLoading || !markdown.trim()}
                    size="sm"
                    variant="outline"
                    onPress={reviewWithAi}
                  >
                    {aiReviewLoading ? t.aiReviewing : t.runAiReview}
                  </Button>
                </div>
                {aiReviewError ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{aiReviewError}</p> : null}
                {aiReview ? (
                  <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto pr-1">
                    <p className="rounded-md bg-sky-50 p-3 text-sm font-semibold text-sky-900">{aiReview.summary}</p>
                    {aiReview.suggestions.length ? (
                      <ul className="grid gap-2">
                        {aiReview.suggestions.map((suggestion, index) => (
                          <li className="rounded-md border border-line bg-white p-3 text-sm" key={`${suggestion.message}-${index}`}>
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded px-2 py-0.5 text-xs font-black uppercase ${
                                  suggestion.severity === "high"
                                    ? "bg-red-100 text-red-800"
                                    : suggestion.severity === "medium"
                                      ? "bg-amber-100 text-amber-900"
                                      : "bg-emerald-100 text-emerald-800"
                                }`}
                              >
                                {t.aiSeverity[suggestion.severity]}
                              </span>
                              {suggestion.slide ? (
                                <span className="text-xs font-semibold text-stone-500">
                                  {t.slidePage} {suggestion.slide}
                                </span>
                              ) : null}
                            </div>
                            <p className="text-stone-700">{suggestion.message}</p>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : !aiReviewError ? (
                  <p className="text-sm text-stone-600">{t.aiReviewEmpty}</p>
                ) : null}
              </Card.Content>
            </Card>
          </aside>
        </section>
      </main>
      {libraryOpen ? (
        <div className="fixed inset-0 z-40">
          <button
            aria-label={t.closeSharedSlides}
            className="absolute inset-0 bg-black/20"
            onClick={() => setLibraryOpen(false)}
            type="button"
          />
          <aside className="absolute right-0 top-0 grid h-full w-full max-w-md content-start gap-4 overflow-y-auto border-l border-line bg-paper p-5 shadow-panel">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-black">{t.sharedSlidesTab}</h2>
              <button className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold" onClick={() => setLibraryOpen(false)} type="button">
                {t.close}
              </button>
            </div>
            <Link className="rounded-md bg-mint px-4 py-3 text-center text-sm font-semibold text-white" href="/shared-slides/new">
              {t.createSharedSlide}
            </Link>
            {libraryError ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{libraryError}</p> : null}
            <div className="grid gap-2">
              {libraryLoading ? <LoadingBlock label={t.sharedSlidesLoading} /> : null}
              {!libraryLoading && librarySlides.length ? (
                librarySlides.map((slide) => (
                  <article className="rounded-md border border-line bg-white p-3" key={slide.id}>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-black">{slide.title}</h3>
                      <p className="mt-1 text-xs text-stone-600">{slide.markdown.split("\n").slice(0, 2).join(" ").slice(0, 120)}</p>
                    </div>
                    <button
                      className="mt-3 h-9 w-full rounded-md bg-mint px-3 text-sm font-semibold text-white"
                      onClick={() => insertLibrarySlideAfterCurrent(slide)}
                      type="button"
                    >
                      {t.addToNextPage}
                    </button>
                    <button
                      className="mt-2 h-9 w-full rounded-md border border-line bg-white px-3 text-sm font-semibold"
                      onClick={() => copyLibrarySlide(slide)}
                      type="button"
                    >
                      {t.copyMarkdown}
                    </button>
                  </article>
                ))
              ) : !libraryLoading ? (
                <div className="rounded-md border border-dashed border-line bg-white p-4">
                  <p className="text-sm text-stone-600">{t.noSharedSlides}</p>
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}
      {mediaOpen ? (
        <div className="fixed inset-0 z-40">
          <button
            aria-label={t.closeMediaLibrary}
            className="absolute inset-0 bg-black/20"
            onClick={() => setMediaOpen(false)}
            type="button"
          />
          <aside className="absolute right-0 top-0 grid h-full w-full max-w-md content-start gap-4 overflow-y-auto border-l border-line bg-paper p-5 shadow-panel">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-black">{t.mediaTab}</h2>
              <button className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold" onClick={() => setMediaOpen(false)} type="button">
                {t.close}
              </button>
            </div>
            <label className="inline-flex cursor-pointer justify-center rounded-md bg-mint px-4 py-3 text-sm font-semibold text-white has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
              {t.uploadMedia}
              <input
                accept="image/*,video/*"
                className="sr-only"
                disabled={uploadingMedia}
                onChange={(event) => {
                  uploadAndInsertMedia(event.target.files?.[0] ?? null);
                  event.currentTarget.value = "";
                }}
                type="file"
              />
            </label>
            {mediaError ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{mediaError}</p> : null}
            <div className="grid gap-2">
              {mediaLoading ? <LoadingBlock label={t.mediaLoading} /> : null}
              {!mediaLoading && media.length ? (
                media.map((item) => (
                  <article className="rounded-md border border-line bg-white p-3" key={item.id}>
                    <div className="aspect-video overflow-hidden rounded-md border border-line bg-paper">
                      {item.contentType.startsWith("video/") ? (
                        <video className="h-full w-full bg-black object-contain" controls preload="metadata" src={item.url} title={item.filename} />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img alt={item.filename} className="h-full w-full object-contain" src={item.url} />
                      )}
                    </div>
                    <h3 className="mt-3 truncate text-sm font-black">{item.filename}</h3>
                    <button
                      className="mt-3 h-9 w-full rounded-md bg-mint px-3 text-sm font-semibold text-white"
                      onClick={() => insertMedia(item)}
                      type="button"
                    >
                      {t.addToCurrentPage}
                    </button>
                    <button
                      className="mt-2 h-9 w-full rounded-md border border-line bg-white px-3 text-sm font-semibold"
                      onClick={() => copyMediaMarkdown(item)}
                      type="button"
                    >
                      {t.copyMarkdown}
                    </button>
                  </article>
                ))
              ) : !mediaLoading ? (
                <div className="rounded-md border border-dashed border-line bg-white p-4">
                  <p className="text-sm text-stone-600">{t.noMedia}</p>
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}
      {presentationPreviewOpen ? (
        <div className="fixed inset-0 z-50 bg-ink">
          <PublicSlideshow
            initialActive={safeActiveSlideIndex}
            onClose={() => setPresentationPreviewOpen(false)}
            presentationMinutes={presentationMinutes}
            slides={presentationSlides}
            title={title || t.untitled}
            updatedAt={deck ? new Date(deck.updatedAt).toLocaleDateString(language === "ja" ? "ja-JP" : "en-US") : t.editing}
          />
        </div>
      ) : null}
    </>
  );
}

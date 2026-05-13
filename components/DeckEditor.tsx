"use client";

import { useParams, useRouter } from "next/navigation";
import { type KeyboardEvent, type MouseEvent, type SyntheticEvent, type TouchEvent, useEffect, useMemo, useState } from "react";
import { Button, Input, Switch, Tabs } from "ufoo-ui";
import { useAuth } from "@/components/AuthProvider";
import { DeckEditorToolbar } from "@/components/DeckEditorToolbar";
import { FactCheckAnswerPanel, FactCheckPopup, type FactCheckPopupPosition, type FactCheckReview } from "@/components/FactCheckUi";
import { Header } from "@/components/Header";
import { LoadingBlock } from "@/components/LoadingBlock";
import { MediaLibraryDrawer, type MediaLibraryItem } from "@/components/MediaLibraryDrawer";
import { PublicSlideshow } from "@/components/PublicSlideshow";
import { SharedSlidesDrawer, type LibrarySlide } from "@/components/SharedSlidesDrawer";
import { SlidePreview } from "@/components/SlidePreview";
import { joinEditableSlides, parseDeckMarkdown, renderSlides, slideThemes, splitEditableSlides, updateDeckSettings, type SlideDeckSettings, type SlideTheme } from "@/lib/markdown";
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

type DeckEditorProps = {
  mode: "new" | "edit";
};

type SavedDeckState = {
  markdown: string;
  presentationMinutes: number;
  title: string;
  visibility: "private" | "public";
};

const initialMarkdown = `---
theme: light
header: ""
footer: ""
---

# 今日話すこと

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
  const [editMode, setEditMode] = useState<"page" | "theme" | "full">("page");
  const [mobilePanel, setMobilePanel] = useState<"markdown" | "preview">("markdown");
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
  const [factCheckMode, setFactCheckMode] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [factCheckPopupPosition, setFactCheckPopupPosition] = useState<FactCheckPopupPosition | null>(null);
  const [factCheckBackground, setFactCheckBackground] = useState("");
  const [aiReview, setAiReview] = useState<FactCheckReview | null>(null);
  const [aiReviewError, setAiReviewError] = useState<string | null>(null);
  const [aiReviewLoading, setAiReviewLoading] = useState(false);
  const [aiReviewMinimized, setAiReviewMinimized] = useState(false);
  const parsedMarkdown = useMemo(() => parseDeckMarkdown(markdown), [markdown]);
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
  const factCheckText = selectedText.trim();

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
    setMarkdown(joinEditableSlides(nextSlides, parsedMarkdown.frontMatter));
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

  function getPopupPosition(clientX: number, clientY: number) {
    if (typeof window === "undefined") {
      return { left: 12, top: 12 };
    }

    const width = Math.min(360, Math.max(280, window.innerWidth - 24));
    const maxLeft = Math.max(12, window.innerWidth - width - 12);
    const maxTop = Math.max(12, window.innerHeight - 260);

    return {
      left: Math.min(Math.max(12, clientX - width / 2), maxLeft),
      top: Math.min(Math.max(12, clientY + 14), maxTop),
    };
  }

  function updateSelectedText(textarea: HTMLTextAreaElement, position?: FactCheckPopupPosition) {
    const nextSelectedText = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd);
    setSelectedText(nextSelectedText);

    if (!factCheckMode || !nextSelectedText.trim()) {
      setFactCheckPopupPosition(null);
      return;
    }

    if (position) {
      setFactCheckPopupPosition(position);
    }
  }

  function captureSelectedText(event: SyntheticEvent<HTMLTextAreaElement>) {
    const textarea = event.currentTarget;
    updateSelectedText(textarea);
  }

  function captureSelectedTextFromMouse(event: MouseEvent<HTMLTextAreaElement>) {
    updateSelectedText(event.currentTarget, getPopupPosition(event.clientX, event.clientY));
  }

  function captureSelectedTextFromTouch(event: TouchEvent<HTMLTextAreaElement>) {
    const touch = event.changedTouches[0];
    if (!touch) return;
    updateSelectedText(event.currentTarget, getPopupPosition(touch.clientX, touch.clientY));
  }

  function captureSelectedTextFromKeyboard(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (typeof window === "undefined") {
      updateSelectedText(event.currentTarget);
      return;
    }

    const top = Math.min(96, window.innerHeight - 260);
    updateSelectedText(event.currentTarget, getPopupPosition(window.innerWidth / 2, top));
  }

  async function reviewWithAi() {
    if (!factCheckText) {
      setAiReviewError(t.aiReviewSelectText);
      return;
    }

    setAiReviewLoading(true);
    setAiReviewError(null);
    setAiReview(null);
    setAiReviewMinimized(false);
    setFactCheckPopupPosition(null);
    try {
      const idToken = await token();
      const response = await fetch("/api/ai/review", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          background: factCheckBackground,
          language,
          markdown,
          selectedText: factCheckText,
          title,
        }),
      });
      const data = (await response.json()) as { review?: FactCheckReview; error?: string; message?: string };
      if (!response.ok || !data.review) {
        if (response.status === 503) {
          throw new Error(t.aiReviewNotConfigured);
        }
        throw new Error(data.message || data.error || t.aiReviewFailed);
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
    setMarkdown(joinEditableSlides(nextSlides, parsedMarkdown.frontMatter));
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
    setMarkdown(joinEditableSlides(nextSlides, parsedMarkdown.frontMatter));
    setActiveSlideIndex(nextSlides.length - 1);
  }

  function deleteActiveSlide() {
    if (slides.length <= 1) {
      setMarkdown("");
      setActiveSlideIndex(0);
      return;
    }

    const nextSlides = slides.filter((_, index) => index !== safeActiveSlideIndex);
    setMarkdown(joinEditableSlides(nextSlides, parsedMarkdown.frontMatter));
    setActiveSlideIndex((index) => Math.min(index, nextSlides.length - 1));
  }

  function updateSlideSettings(nextSettings: SlideDeckSettings) {
    setMarkdown((currentMarkdown) => updateDeckSettings(currentMarkdown, nextSettings));
  }

  function updateSlideSetting<Key extends keyof SlideDeckSettings>(key: Key, value: SlideDeckSettings[Key]) {
    updateSlideSettings({
      ...parsedMarkdown.settings,
      [key]: value,
    });
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
      const normalizedMarkdown = joinEditableSlides(normalizedSlides, parsedMarkdown.frontMatter);
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
      <main className="mx-auto flex min-h-[calc(100dvh-4rem-1px)] max-w-7xl flex-col gap-3 px-3 py-3 sm:px-4 sm:py-5 lg:h-[calc(100dvh-4rem-1px)] lg:gap-4 lg:overflow-hidden">
        <DeckEditorToolbar
          busy={busy}
          hasUnsavedChanges={hasUnsavedChanges}
          presentationMinutes={presentationMinutes}
          publicSlug={deck?.visibility === "public" ? deck.slug : null}
          title={title}
          visibility={visibility}
          onLibraryOpen={() => setLibraryOpen(true)}
          onMediaOpen={() => setMediaOpen(true)}
          onPresentationMinutesChange={setPresentationMinutes}
          onSave={save}
          onTitleChange={setTitle}
          onVisibilityChange={setVisibility}
        />

        {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {status ? <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{status}</p> : null}

        <section className="grid min-h-0 flex-1 content-start gap-1.5 lg:hidden">
          <Tabs
            aria-label={`${t.fullMarkdown} / ${t.preview}`}
            selectedKey={mobilePanel}
            onSelectionChange={(key) => {
              if (key === "preview") {
                setMobilePanel("preview");
                return;
              }
              setMobilePanel("markdown");
            }}
          >
            <Tabs.List className="grid grid-cols-2 rounded-md border border-line bg-white p-1">
              <Tabs.Tab className="rounded px-3 py-2 text-sm font-semibold" id="markdown">
                {t.fullMarkdown}
              </Tabs.Tab>
              <Tabs.Tab className="rounded px-3 py-2 text-sm font-semibold" id="preview">
                {t.preview}
              </Tabs.Tab>
            </Tabs.List>
          </Tabs>
          {mobilePanel === "markdown" ? (
            <textarea
              className="min-h-[calc(100dvh-14.5rem)] resize-none rounded-lg border border-line bg-[#fffdf8] p-3 font-mono text-sm leading-6 outline-mint"
              onKeyDown={(event) => insertTextareaTab(event, setMarkdown)}
              onKeyUp={captureSelectedTextFromKeyboard}
              onChange={(event) => setMarkdown(event.target.value)}
              onMouseUp={captureSelectedTextFromMouse}
              onSelect={captureSelectedText}
              onTouchEnd={captureSelectedTextFromTouch}
              spellCheck={false}
              value={markdown}
            />
          ) : mobilePanel === "preview" ? (
            <div className="grid content-start gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-stone-600">{t.slidePage}: {safeActiveSlideIndex + 1}</span>
                <Button
                  aria-label={t.presentationView}
                  className="h-10 w-10 min-w-10 px-0"
                  size="sm"
                  variant="outline"
                  onPress={() => setPresentationPreviewOpen(true)}
                >
                  <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                    <rect height="14" rx="2" width="20" x="2" y="3" />
                    <path d="M8 21h8" />
                    <path d="M12 17v4" />
                  </svg>
                </Button>
              </div>
              <SlidePreview
                activeIndex={safeActiveSlideIndex}
                compact
                markdown={markdown}
                onActiveIndexChange={setActiveSlideIndex}
              />
            </div>
          ) : null}
        </section>

        <section className="hidden min-h-0 flex-1 items-start gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(24rem,1fr)] lg:items-stretch lg:overflow-hidden">
          <div className="flex min-h-0 flex-col gap-3 lg:h-full">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h1 className="text-sm font-black uppercase tracking-normal text-stone-600">Markdown</h1>
              <span className="text-sm font-semibold text-stone-600">
                {editMode === "page" ? `${safeActiveSlideIndex + 1} / ${slideCount}` : `${slideCount} ${language === "ja" ? "slides" : "slides"}`}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Tabs
                aria-label={t.pageEdit}
                selectedKey={editMode}
                onSelectionChange={(key) => {
                  if (key === "theme" || key === "full") {
                    setEditMode(key);
                    return;
                  }
                  setEditMode("page");
                }}
              >
                <Tabs.List className="rounded-md border border-line bg-white p-1">
                  <Tabs.Tab className="rounded px-3 py-2 text-sm font-semibold" id="page">
                    {t.pageEdit}
                  </Tabs.Tab>
                  <Tabs.Tab className="rounded px-3 py-2 text-sm font-semibold" id="theme">
                    {t.themeSettings}
                  </Tabs.Tab>
                  <Tabs.Tab className="rounded px-3 py-2 text-sm font-semibold" id="full">
                    {t.fullMarkdown}
                  </Tabs.Tab>
                </Tabs.List>
              </Tabs>
              <Switch
                className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-semibold"
                isSelected={factCheckMode}
                size="sm"
                onChange={(selected) => {
                  setFactCheckMode(selected);
                  if (!selected) {
                    setFactCheckPopupPosition(null);
                  }
                }}
              >
                <Switch.Control
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    factCheckMode ? "bg-mint" : "bg-stone-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 block h-4 w-4 rounded-full bg-white shadow transition-[left] ${
                      factCheckMode ? "left-[18px]" : "left-0.5"
                    }`}
                  />
                </Switch.Control>
                {t.aiReviewMode}
              </Switch>
            </div>
            {editMode === "page" ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <Button
                    className="w-full sm:w-auto"
                    isDisabled={safeActiveSlideIndex === 0}
                    size="sm"
                    variant="outline"
                    onPress={goPreviousSlide}
                  >
                    {t.previousPage}
                  </Button>
                  <Button
                    className="w-full sm:w-auto"
                    isDisabled={!activeSlideMarkdown.trim()}
                    size="sm"
                    variant="outline"
                    onPress={goNextSlide}
                  >
                    {t.nextPage}
                  </Button>
                </div>
                <Button className="w-full sm:w-auto" size="sm" variant="outline" onPress={deleteActiveSlide}>
                  {t.deletePage}
                </Button>
              </div>
            ) : null}
            {editMode === "page" ? (
              <textarea
                className="min-h-[18rem] resize-none rounded-lg border border-line bg-[#fffdf8] p-4 font-mono text-sm leading-6 outline-mint sm:min-h-[24rem] lg:min-h-0 lg:flex-1"
                onKeyDown={(event) => insertTextareaTab(event, updateActiveSlide)}
                onKeyUp={captureSelectedTextFromKeyboard}
                onChange={(event) => updateActiveSlide(event.target.value)}
                onMouseUp={captureSelectedTextFromMouse}
                onSelect={captureSelectedText}
                onTouchEnd={captureSelectedTextFromTouch}
                spellCheck={false}
                value={activeSlideMarkdown}
              />
            ) : editMode === "theme" ? (
              <div className="grid content-start gap-4 rounded-lg border border-line bg-white/90 p-4 shadow-panel">
                <label className="grid gap-1 text-sm font-semibold">
                  {t.slideTheme}
                  <select
                    className="h-10 rounded-md border border-line bg-white px-3 text-sm font-semibold outline-mint"
                    onChange={(event) => updateSlideSetting("theme", event.target.value as SlideTheme)}
                    value={parsedMarkdown.settings.theme}
                  >
                    {slideThemes.map((theme) => (
                      <option key={theme} value={theme}>
                        {theme === "dark"
                          ? t.slideThemeDark
                          : theme === "light"
                            ? t.slideThemeLight
                            : t.slideThemeMint}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold">
                  {t.slideHeader}
                  <Input
                    onChange={(event) => updateSlideSetting("header", event.target.value)}
                    value={parsedMarkdown.settings.header}
                    variant="primary"
                  />
                </label>
                <label className="grid gap-1 text-sm font-semibold">
                  {t.slideFooter}
                  <Input
                    onChange={(event) => updateSlideSetting("footer", event.target.value)}
                    value={parsedMarkdown.settings.footer}
                    variant="primary"
                  />
                </label>
                <div className="rounded-md bg-stone-100 p-3 text-xs leading-5 text-stone-600">
                  <code>{`---\ntheme: ${parsedMarkdown.settings.theme}\nheader: ${JSON.stringify(parsedMarkdown.settings.header)}\nfooter: ${JSON.stringify(parsedMarkdown.settings.footer)}\n---`}</code>
                </div>
              </div>
            ) : (
              <textarea
                className="min-h-[18rem] resize-none rounded-lg border border-line bg-[#fffdf8] p-4 font-mono text-sm leading-6 outline-mint sm:min-h-[24rem] lg:min-h-0 lg:flex-1"
                onKeyDown={(event) => insertTextareaTab(event, setMarkdown)}
                onKeyUp={captureSelectedTextFromKeyboard}
                onChange={(event) => setMarkdown(event.target.value)}
                onMouseUp={captureSelectedTextFromMouse}
                onSelect={captureSelectedText}
                onTouchEnd={captureSelectedTextFromTouch}
                spellCheck={false}
                value={markdown}
              />
            )}
          </div>
          <aside className="grid min-h-0 gap-4 lg:h-full">
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-black uppercase tracking-normal text-stone-600">{t.preview}</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-stone-600">{t.slidePage}: {safeActiveSlideIndex + 1}</span>
                  <Button className="w-full sm:w-auto" size="sm" variant="outline" onPress={() => setPresentationPreviewOpen(true)}>
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
          </aside>
        </section>
      </main>
      <FactCheckPopup
        background={factCheckBackground}
        factCheckText={factCheckText}
        isLoading={aiReviewLoading}
        position={factCheckPopupPosition}
        onBackgroundChange={setFactCheckBackground}
        onClose={() => setFactCheckPopupPosition(null)}
        onRun={reviewWithAi}
      />
      <FactCheckAnswerPanel
        error={aiReviewError}
        isLoading={aiReviewLoading}
        isMinimized={aiReviewMinimized}
        review={aiReview}
        onMinimizedChange={setAiReviewMinimized}
      />
      {libraryOpen ? (
        <SharedSlidesDrawer
          error={libraryError}
          isLoading={libraryLoading}
          slides={librarySlides}
          onClose={() => setLibraryOpen(false)}
          onCopySlide={copyLibrarySlide}
          onInsertSlide={insertLibrarySlideAfterCurrent}
        />
      ) : null}
      {mediaOpen ? (
        <MediaLibraryDrawer
          error={mediaError}
          isLoading={mediaLoading}
          isUploading={uploadingMedia}
          media={media}
          onClose={() => setMediaOpen(false)}
          onCopyMedia={copyMediaMarkdown}
          onInsertMedia={insertMedia}
          onUpload={uploadAndInsertMedia}
        />
      ) : null}
      {presentationPreviewOpen ? (
        <div className="fixed inset-0 z-50 bg-ink">
          <PublicSlideshow
            initialActive={safeActiveSlideIndex}
            onClose={() => setPresentationPreviewOpen(false)}
            presentationMinutes={presentationMinutes}
            settings={parsedMarkdown.settings}
            slides={presentationSlides}
            title={title || t.untitled}
            updatedAt={deck ? new Date(deck.updatedAt).toLocaleDateString(language === "ja" ? "ja-JP" : "en-US") : t.editing}
          />
        </div>
      ) : null}
    </>
  );
}

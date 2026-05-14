"use client";

import { useParams, useRouter } from "next/navigation";
import { type KeyboardEvent, type MouseEvent, type SyntheticEvent, type TouchEvent, useEffect, useMemo, useState } from "react";
import {
  Button,
  EditorShell,
  InspectorField,
  InspectorInput,
  InspectorPanel,
  InspectorSection,
  SlideThumbnail,
  Switch,
  ToolButton,
  Toolbar,
  ToolbarGroup,
} from "ufoo-ui";
import { useAuth } from "@/components/AuthProvider";
import { DeckEditorToolbar } from "@/components/DeckEditorToolbar";
import { FactCheckAnswerPanel, FactCheckPopup, type FactCheckPopupPosition, type FactCheckReview } from "@/components/FactCheckUi";
import { Header } from "@/components/Header";
import { LoadingBlock } from "@/components/LoadingBlock";
import { MediaLibraryDrawer, type MediaLibraryItem } from "@/components/MediaLibraryDrawer";
import { PublicSlideshow } from "@/components/PublicSlideshow";
import { SharedSlidesDrawer, type LibrarySlide } from "@/components/SharedSlidesDrawer";
import { SlideContent } from "@/components/SlideContent";
import { SlidePreview } from "@/components/SlidePreview";
import { joinEditableSlides, parseDeckMarkdown, renderSlides, slideThemeClasses, slideThemes, splitEditableSlides, updateDeckSettings, type SlideDeckSettings, type SlideTheme } from "@/lib/markdown";
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

function slideTitle(markdown: string, fallback: string) {
  const heading = markdown
    .split("\n")
    .map((line) => line.trim())
    .find((line) => /^#{1,3}\s+/.test(line));

  return heading?.replace(/^#{1,3}\s+/, "").trim() || fallback;
}

function slideStatsLabel(markdown: string) {
  const nonEmptyLines = markdown.split("\n").filter((line) => line.trim()).length;
  return `${nonEmptyLines} lines`;
}

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
  const [fullMarkdownOpen, setFullMarkdownOpen] = useState(false);
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [savedState, setSavedState] = useState<SavedDeckState>(initialSavedState);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [slideNavigatorOpen, setSlideNavigatorOpen] = useState(true);
  const [themeInspectorOpen, setThemeInspectorOpen] = useState(true);
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
  const themeClasses = useMemo(() => slideThemeClasses(parsedMarkdown.settings.theme), [parsedMarkdown.settings.theme]);
  const slideNavigatorItems = useMemo(
    () => slides.map((slide, index) => ({
      html: presentationSlides[index]?.html ?? "",
      meta: `${slideStatsLabel(slide)} Markdown`,
      title: slideTitle(slide, `${t.slidePage} ${index + 1}`),
    })),
    [presentationSlides, slides, t],
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
    const height = 260;
    const maxLeft = Math.max(12, window.innerWidth - width - 12);
    const maxTop = Math.max(12, window.innerHeight - height - 12);
    const preferredLeft = clientX + 18;

    return {
      left: Math.min(Math.max(12, preferredLeft), maxLeft),
      top: Math.min(Math.max(12, clientY - height / 2), maxTop),
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
    }
  }

  function addNewSlideAfterCurrent() {
    const nextSlides = [...slides];
    const insertIndex = safeActiveSlideIndex + 1;
    nextSlides.splice(insertIndex, 0, "");
    setMarkdown(joinEditableSlides(nextSlides, parsedMarkdown.frontMatter));
    setActiveSlideIndex(insertIndex);
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
        <main className="w-full px-4 py-8">
          <LoadingBlock label={deckLoading ? t.deckLoading : t.authChecking} />
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="flex min-h-[calc(100dvh-4rem-1px)] w-full flex-col gap-3 px-3 py-3 sm:px-4 sm:py-5 lg:h-[calc(100dvh-4rem-1px)] lg:gap-4 lg:overflow-hidden">
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

        <section className="grid min-h-0 flex-1 content-start gap-2 lg:hidden">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-stone-600">{t.slidePage}: {safeActiveSlideIndex + 1}</span>
            <Button size="sm" variant="outline" onPress={() => setFullMarkdownOpen(true)}>
              {t.fullMarkdown}
            </Button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <Button aria-label={t.previousPage} isDisabled={safeActiveSlideIndex === 0} size="sm" variant="outline" onPress={goPreviousSlide}>
              ‹
            </Button>
            <Button aria-label={t.nextPage} isDisabled={safeActiveSlideIndex >= slides.length - 1} size="sm" variant="outline" onPress={goNextSlide}>
              ›
            </Button>
            <Button aria-label={t.newPage} size="sm" variant="outline" onPress={addNewSlideAfterCurrent}>
              +
            </Button>
            <Button aria-label={t.deletePage} size="sm" variant="outline" onPress={deleteActiveSlide}>
              <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M3 6h18" />
                <path d="M8 6V4h8v2" />
                <path d="M19 6l-1 15H6L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
              </svg>
            </Button>
          </div>
          <textarea
            className="editor-markdown-textarea min-h-[42dvh] resize-none rounded-lg border border-line p-3 font-mono text-sm leading-6 outline-mint"
            onKeyDown={(event) => insertTextareaTab(event, updateActiveSlide)}
            onKeyUp={captureSelectedTextFromKeyboard}
            onChange={(event) => updateActiveSlide(event.target.value)}
            onMouseUp={captureSelectedTextFromMouse}
            onSelect={captureSelectedText}
            onTouchEnd={captureSelectedTextFromTouch}
            spellCheck={false}
            value={activeSlideMarkdown}
          />
          <SlidePreview
            activeIndex={safeActiveSlideIndex}
            compact
            hideControls
            markdown={markdown}
            onActiveIndexChange={setActiveSlideIndex}
          />
        </section>

        <EditorShell
          className="deck-editor-shell hidden min-h-0 flex-1 rounded-lg bg-ufoo-dark text-ufoo-ink lg:grid"
          toolbar={
            <Toolbar className="justify-end">
              <ToolbarGroup label="Panels">
                <ToolButton
                  active={slideNavigatorOpen}
                  icon="◧"
                  label={t.slidePage}
                  onClick={() => setSlideNavigatorOpen((open) => !open)}
                />
                <ToolButton
                  active={themeInspectorOpen}
                  icon="◨"
                  label={t.themeSettings}
                  onClick={() => setThemeInspectorOpen((open) => !open)}
                />
              </ToolbarGroup>
              <ToolbarGroup label={t.mediaTab}>
                <ToolButton
                  icon={
                    <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                      <rect height="18" rx="2" width="18" x="3" y="3" />
                      <circle cx="9" cy="9" r="2" />
                      <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
                    </svg>
                  }
                  label={t.mediaTab}
                  showLabel
                  onClick={() => setMediaOpen(true)}
                />
                <ToolButton
                  icon={
                    <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                      <rect height="14" rx="2" width="18" x="3" y="5" />
                      <path d="M7 9h10" />
                      <path d="M7 13h6" />
                    </svg>
                  }
                  label={t.sharedSlidesTab}
                  showLabel
                  onClick={() => setLibraryOpen(true)}
                />
              </ToolbarGroup>
              <ToolbarGroup label={t.fullMarkdown}>
                <ToolButton
                  icon="M"
                  label={t.fullMarkdown}
                  showLabel
                  onClick={() => setFullMarkdownOpen(true)}
                />
              </ToolbarGroup>
              <ToolbarGroup label={t.presentationView}>
                <ToolButton
                  icon="▣"
                  label={t.presentationView}
                  showLabel
                  onClick={() => setPresentationPreviewOpen(true)}
                />
              </ToolbarGroup>
              <ToolbarGroup label={t.aiReview}>
                <Switch
                  className="flex h-8 shrink-0 items-center justify-center gap-2 rounded-md border border-ufoo-panel-border px-2 text-sm font-semibold text-ufoo-ink"
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
                      factCheckMode ? "bg-ufoo-neon" : "bg-ufoo-muted"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 block h-4 w-4 rounded-full bg-ufoo-dark shadow transition-[left] ${
                        factCheckMode ? "left-[18px]" : "left-0.5"
                      }`}
                    />
                  </Switch.Control>
                  {t.aiReviewMode}
                </Switch>
              </ToolbarGroup>
              <ToolbarGroup label={t.presentationTime}>
                <label className="flex h-7 shrink-0 items-center gap-1 rounded-md border border-ufoo-panel-border px-2 text-sm font-semibold text-ufoo-ink">
                  <span className="sr-only">{t.presentationTime}</span>
                  <svg aria-hidden="true" className="h-4 w-4 shrink-0 text-ufoo-muted" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                  <input
                    aria-label={t.presentationTime}
                    className="h-6 w-10 bg-transparent text-right outline-none"
                    max={180}
                    min={1}
                    onChange={(event) => setPresentationMinutes(Math.max(1, Math.min(180, Number(event.target.value) || 1)))}
                    type="number"
                    value={presentationMinutes}
                  />
                  <span className="text-xs text-ufoo-muted">{t.minutesUnit}</span>
                </label>
                <Switch
                  className="flex h-7 shrink-0 items-center justify-center gap-2 rounded-md border border-ufoo-panel-border px-2 text-sm font-semibold text-ufoo-ink"
                  isSelected={visibility === "public"}
                  size="sm"
                  onChange={(selected) => setVisibility(selected ? "public" : "private")}
                >
                  <Switch.Control
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      visibility === "public" ? "bg-ufoo-neon" : "bg-ufoo-muted"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 block h-4 w-4 rounded-full bg-ufoo-dark shadow transition-[left] ${
                        visibility === "public" ? "left-[18px]" : "left-0.5"
                      }`}
                    />
                  </Switch.Control>
                  {t.public}
                </Switch>
              </ToolbarGroup>
              <ToolbarGroup label={t.save}>
                <ToolButton
                  disabled={busy || !title.trim() || !hasUnsavedChanges}
                  icon={
                    <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
                      <path d="M17 21v-8H7v8" />
                      <path d="M7 3v5h8" />
                    </svg>
                  }
                  label={t.save}
                  showLabel
                  onClick={save}
                />
              </ToolbarGroup>
            </Toolbar>
          }
          sidebar={
            slideNavigatorOpen ? (
            <div className="grid gap-2 p-3">
              <div className="grid gap-2">
                {slideNavigatorItems.map((item, index) => (
                  <div className="relative" key={index}>
                    <SlideThumbnail
                      meta={item.meta}
                      selected={index === safeActiveSlideIndex}
                      slideNumber={index + 1}
                      title={item.title}
                      onClick={() => setActiveSlideIndex(index)}
                    >
                      <div className={`h-full overflow-hidden ${themeClasses.slide}`}>
                        <div className="relative h-full">
                          {parsedMarkdown.settings.header ? (
                            <div className="pointer-events-none absolute left-2 right-2 top-1 z-10 truncate text-[0.42rem] font-semibold opacity-60">
                              {parsedMarkdown.settings.header}
                            </div>
                          ) : null}
                          <SlideContent
                            className="slide-content slide-thumbnail-content flex h-full flex-col justify-center px-2 py-3"
                            html={item.html}
                          />
                          {parsedMarkdown.settings.footer ? (
                            <div className="pointer-events-none absolute bottom-1 left-2 right-2 z-10 truncate text-[0.42rem] font-semibold opacity-60">
                              {parsedMarkdown.settings.footer}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </SlideThumbnail>
                    {index === safeActiveSlideIndex ? (
                      <button
                        aria-label={t.deletePage}
                        className="absolute right-2 top-2 z-10 grid h-7 w-7 place-items-center rounded-md border border-red-300 bg-red-600 text-white shadow-lg transition-colors hover:border-red-300 hover:bg-red-500"
                        onClick={deleteActiveSlide}
                        type="button"
                      >
                        <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M3 6h18" />
                          <path d="M8 6V4h8v2" />
                          <path d="M19 6l-1 15H6L5 6" />
                          <path d="M10 11v6" />
                          <path d="M14 11v6" />
                        </svg>
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
              <button
                className="grid h-10 w-full place-items-center rounded-md border border-dashed border-ufoo-panel-border text-lg font-semibold text-ufoo-muted transition-colors hover:border-ufoo-neon hover:bg-ufoo-neon/10 hover:text-ufoo-neon"
                onClick={addNewSlideAfterCurrent}
                title={t.newPage}
                type="button"
              >
                +
              </button>
            </div>
            ) : undefined
          }
          inspector={
            themeInspectorOpen ? (
            <InspectorPanel title={t.themeSettings}>
              <InspectorSection title={t.slideTheme}>
                <InspectorField label={t.slideTheme}>
                  <select
                    className="h-8 w-full rounded-md border border-ufoo-panel-border bg-[#0c0f15] px-2 text-sm text-white outline-none focus:border-ufoo-neon focus:ring-1 focus:ring-ufoo-neon"
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
                </InspectorField>
                <InspectorField label={t.slideHeader}>
                  <InspectorInput
                    onChange={(event) => updateSlideSetting("header", event.target.value)}
                    value={parsedMarkdown.settings.header}
                  />
                </InspectorField>
                <InspectorField label={t.slideFooter}>
                  <InspectorInput
                    onChange={(event) => updateSlideSetting("footer", event.target.value)}
                    value={parsedMarkdown.settings.footer}
                  />
                </InspectorField>
              </InspectorSection>
              <InspectorSection title="Front matter">
                <pre className="overflow-x-auto rounded-md border border-ufoo-panel-border bg-[#0c0f15] p-3 text-xs leading-5 text-slate-200">
                  {`---\ntheme: ${parsedMarkdown.settings.theme}\nheader: ${JSON.stringify(parsedMarkdown.settings.header)}\nfooter: ${JSON.stringify(parsedMarkdown.settings.footer)}\n---`}
                </pre>
              </InspectorSection>
            </InspectorPanel>
            ) : undefined
          }
          statusbar={
            <div className="flex items-center justify-between gap-3">
              <span>{safeActiveSlideIndex + 1} / {slideCount}</span>
              <span>{hasUnsavedChanges ? t.unsavedChanges : t.saved}</span>
            </div>
          }
        >
          <div className="grid h-full min-h-0 gap-5 xl:grid-cols-[minmax(24rem,0.85fr)_minmax(36rem,1.35fr)]">
            <textarea
              className="editor-markdown-textarea h-full min-h-0 resize-none rounded-lg border border-ufoo-panel-border p-4 font-mono text-sm leading-6 outline-ufoo-neon"
              onKeyDown={(event) => insertTextareaTab(event, updateActiveSlide)}
              onKeyUp={captureSelectedTextFromKeyboard}
              onChange={(event) => updateActiveSlide(event.target.value)}
              onMouseUp={captureSelectedTextFromMouse}
              onSelect={captureSelectedText}
              onTouchEnd={captureSelectedTextFromTouch}
              spellCheck={false}
              value={activeSlideMarkdown}
            />
            <InspectorPanel className="min-h-0 min-w-0 overflow-y-auto rounded-lg border border-ufoo-panel-border bg-[#15171d] text-white" title={t.preview}>
              <InspectorSection title={`${t.slidePage}: ${safeActiveSlideIndex + 1}`}>
                <SlidePreview
                  activeIndex={safeActiveSlideIndex}
                  editableMedia
                  markdown={markdown}
                  onActiveIndexChange={setActiveSlideIndex}
                  onActiveSlideMarkdownChange={updateActiveSlide}
                />
              </InspectorSection>
            </InspectorPanel>
          </div>
        </EditorShell>
      </main>
      <FactCheckPopup
        background={factCheckBackground}
        factCheckText={factCheckText}
        isLoading={aiReviewLoading}
        position={factCheckPopupPosition}
        onBackgroundChange={setFactCheckBackground}
        onClose={() => setFactCheckPopupPosition(null)}
        onPositionChange={setFactCheckPopupPosition}
        onRun={reviewWithAi}
      />
      {error || status ? (
        <div className="pointer-events-none fixed bottom-4 right-4 z-[60] grid w-[calc(100vw-2rem)] max-w-sm gap-2">
          {error ? (
            <p className="pointer-events-auto rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700 shadow-2xl">
              {error}
            </p>
          ) : null}
          {status ? (
            <p className="pointer-events-auto rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700 shadow-2xl">
              {status}
            </p>
          ) : null}
        </div>
      ) : null}
      {aiReviewLoading || aiReviewError || aiReview ? (
        <FactCheckAnswerPanel
          error={aiReviewError}
          isLoading={aiReviewLoading}
          isMinimized={aiReviewMinimized}
          review={aiReview}
          onMinimizedChange={setAiReviewMinimized}
        />
      ) : null}
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
      {fullMarkdownOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="grid max-h-[calc(100dvh-2rem)] w-full max-w-5xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border border-ufoo-panel-border bg-ufoo-panel shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-ufoo-panel-border px-4 py-3">
              <h2 className="text-sm font-black uppercase tracking-normal text-ufoo-ink">{t.fullMarkdown}</h2>
              <Button size="sm" variant="outline" onPress={() => setFullMarkdownOpen(false)}>
                {t.close}
              </Button>
            </div>
            <textarea
              className="editor-markdown-textarea min-h-[min(42rem,calc(100dvh-10rem))] resize-none border-0 p-4 font-mono text-sm leading-6 outline-ufoo-neon"
              onKeyDown={(event) => insertTextareaTab(event, setMarkdown)}
              onKeyUp={captureSelectedTextFromKeyboard}
              onChange={(event) => setMarkdown(event.target.value)}
              onMouseUp={captureSelectedTextFromMouse}
              onSelect={captureSelectedText}
              onTouchEnd={captureSelectedTextFromTouch}
              spellCheck={false}
              value={markdown}
            />
            <div className="flex items-center justify-between gap-3 border-t border-ufoo-panel-border px-4 py-3 text-xs text-ufoo-muted">
              <span>{slideCount} slides</span>
              <span>{hasUnsavedChanges ? t.unsavedChanges : t.saved}</span>
            </div>
          </div>
        </div>
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

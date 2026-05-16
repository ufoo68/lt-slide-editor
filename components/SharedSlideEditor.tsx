"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button, EditorShell, InspectorPanel, InspectorSection, ToolButton, Toolbar, ToolbarGroup } from "ufoo-ui";
import { Header } from "@/components/Header";
import { LoadingBlock } from "@/components/LoadingBlock";
import { MediaLibraryDrawer } from "@/components/MediaLibraryDrawer";
import { SlidePreview } from "@/components/SlidePreview";
import { useAuth } from "@/components/AuthProvider";
import { splitSlides } from "@/lib/markdown";
import { insertTextareaTab } from "@/lib/textarea";
import { useLanguage } from "@/lib/i18n";

const initialMarkdown = `# 自己紹介

- 名前
- やっていること
- 今日話すこと
`;

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

type SharedSlideEditorProps = {
  mode: "new" | "edit";
};

type SavedSharedSlideState = {
  markdown: string;
  title: string;
};

export function SharedSlideEditor({ mode }: SharedSlideEditorProps) {
  const params = useParams<{ id?: string }>();
  const router = useRouter();
  const { user, loading, token } = useAuth();
  const { t } = useLanguage();
  const initialSavedState = useMemo<SavedSharedSlideState>(
    () => ({
      markdown: mode === "new" ? initialMarkdown : "",
      title: mode === "new" ? "自己紹介" : "",
    }),
    [mode],
  );
  const [title, setTitle] = useState(mode === "new" ? "自己紹介" : "");
  const [markdown, setMarkdown] = useState(mode === "new" ? initialMarkdown : "");
  const [savedState, setSavedState] = useState<SavedSharedSlideState>(initialSavedState);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [slideLoading, setSlideLoading] = useState(mode === "edit");
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [media, setMedia] = useState<MediaLibraryItem[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const slideCount = useMemo(() => splitSlides(markdown).length, [markdown]);
  const hasSeparator = useMemo(() => /\n---\s*(?:\n|$)/.test(markdown), [markdown]);
  const invalidSlideCount = slideCount !== 1 || hasSeparator;
  const hasUnsavedChanges = title !== savedState.title || markdown !== savedState.markdown;

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, router, user]);

  useEffect(() => {
    async function loadSlide() {
      if (!user || mode !== "edit" || !params.id) return;
      setError(null);
      setSlideLoading(true);
      try {
        const idToken = await token();
        const response = await fetch(`/api/shared-slides/${params.id}`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!response.ok) {
          setError(t.sharedSlideLoadFailed);
          return;
        }
        const data = (await response.json()) as { slide: LibrarySlide };
        setTitle(data.slide.title);
        setMarkdown(data.slide.markdown);
        setSavedState({
          markdown: data.slide.markdown,
          title: data.slide.title,
        });
      } catch {
        setError(t.sharedSlideLoadFailed);
      } finally {
        setSlideLoading(false);
      }
    }
    loadSlide();
  }, [mode, params.id, t, token, user]);

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

  function mediaMarkdownWithLayout(item: MediaLibraryItem) {
    return item.markdown;
  }

  function insertMedia(item: MediaLibraryItem) {
    const mediaMarkdown = mediaMarkdownWithLayout(item);
    const separator = markdown.trim() ? "\n\n" : "";
    setMarkdown(`${markdown}${separator}${mediaMarkdown}`);
    setMediaOpen(false);
    setStatus(`${t.addToSharedSlide}: ${item.filename}`);
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

  async function copyMediaMarkdown(item: MediaLibraryItem) {
    setMediaError(null);
    try {
      await navigator.clipboard.writeText(mediaMarkdownWithLayout(item));
      setStatus(t.copiedMarkdown(item.filename));
    } catch {
      setMediaError(t.clipboardFailed);
    }
  }

  async function saveSlide() {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      if (invalidSlideCount) {
        throw new Error(t.sharedSlideOnePageOnly);
      }

      const idToken = await token();
      const response = await fetch(mode === "edit" ? `/api/shared-slides/${params.id}` : "/api/shared-slides", {
        method: mode === "edit" ? "PUT" : "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title, markdown }),
      });
      if (!response.ok) {
        throw new Error(t.sharedSlideSavedFailed);
      }
      const data = (await response.json()) as { slide: LibrarySlide };
      setTitle(data.slide.title);
      setMarkdown(data.slide.markdown);
      setSavedState({
        markdown: data.slide.markdown,
        title: data.slide.title,
      });
      setStatus(t.saved);
      if (mode === "new") {
        router.replace(`/shared-slides/${data.slide.id}/edit`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.sharedSlideSavedFailed);
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user || slideLoading) {
    return (
      <>
        <Header />
        <main className="w-full px-4 py-8">
          <LoadingBlock label={slideLoading ? t.sharedSlideLoading : t.authChecking} />
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="flex min-h-[calc(100dvh-4rem-1px)] w-full flex-col gap-3 px-3 py-3 sm:px-4 sm:py-5 lg:h-[calc(100dvh-4rem-1px)] lg:gap-3 lg:overflow-hidden lg:py-3">
        <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2 sm:block">
            <Link
              aria-label={t.dashboard}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-line bg-white text-foreground sm:hidden"
              href="/dashboard"
            >
              <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </Link>
            <Link className="hidden text-sm font-semibold text-primary sm:inline" href="/dashboard">
              {t.dashboard}
            </Link>
            <input
              className="block min-w-0 flex-1 bg-transparent text-base font-black outline-none sm:mt-1 sm:w-full sm:text-2xl lg:min-w-72"
              onChange={(event) => setTitle(event.target.value)}
              value={title}
            />
          </div>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2 lg:hidden">
            <Button
              aria-label={mobilePreviewOpen ? t.pageEdit : t.preview}
              className="h-9 w-9 min-w-9 shrink-0 px-0 sm:h-10 sm:w-auto sm:px-3"
              variant="outline"
              onPress={() => setMobilePreviewOpen((open) => !open)}
            >
              <svg aria-hidden="true" className="h-4 w-4 sm:mr-1" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                {mobilePreviewOpen ? (
                  <path d="M12 20h9" />
                ) : (
                  <>
                    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
                    <circle cx="12" cy="12" r="3" />
                  </>
                )}
              </svg>
              <span className="hidden sm:inline">{mobilePreviewOpen ? t.pageEdit : t.preview}</span>
            </Button>
            <Button aria-label={t.mediaTab} className="h-9 w-9 min-w-9 shrink-0 px-0 sm:h-10 sm:w-auto sm:px-3" variant="outline" onPress={() => setMediaOpen(true)}>
              <svg aria-hidden="true" className="h-4 w-4 sm:mr-1" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                <rect height="18" rx="2" width="18" x="3" y="3" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
              </svg>
              <span className="hidden sm:inline">{t.mediaTab}</span>
            </Button>
            <Button
              aria-label={t.save}
              className="h-9 w-9 min-w-9 shrink-0 px-0 sm:h-10 sm:w-auto sm:px-3"
              isDisabled={busy || !title.trim() || !markdown.trim() || invalidSlideCount || !hasUnsavedChanges}
              variant="primary"
              onPress={saveSlide}
            >
              <svg aria-hidden="true" className="h-4 w-4 sm:mr-1" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
                <path d="M17 21v-8H7v8" />
                <path d="M7 3v5h8" />
              </svg>
              <span className="hidden sm:inline">{t.save}</span>
            </Button>
          </div>
        </div>

        <section className="grid min-h-0 flex-1 content-start gap-2 lg:hidden">
          {mobilePreviewOpen ? (
            <div className="grid min-h-[42dvh] place-items-center rounded-lg border border-line bg-paper p-2">
              <SlidePreview className="w-full" compact hideControls markdown={markdown} />
            </div>
          ) : (
            <textarea
              className="editor-markdown-textarea min-h-[42dvh] resize-none rounded-lg border border-line p-3 font-mono text-sm leading-6 outline-mint"
              onKeyDown={(event) => insertTextareaTab(event, setMarkdown)}
              onChange={(event) => setMarkdown(event.target.value)}
              spellCheck={false}
              value={markdown}
            />
          )}
        </section>

        <EditorShell
          className="deck-editor-shell hidden min-h-0 flex-1 rounded-lg bg-ufoo-dark text-ufoo-ink lg:grid"
          toolbar={
            <Toolbar className="justify-end">
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
              </ToolbarGroup>
              <ToolbarGroup label={t.save}>
                <ToolButton
                  disabled={busy || !title.trim() || !markdown.trim() || invalidSlideCount || !hasUnsavedChanges}
                  icon={
                    <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
                      <path d="M17 21v-8H7v8" />
                      <path d="M7 3v5h8" />
                    </svg>
                  }
                  label={t.save}
                  showLabel
                  onClick={saveSlide}
                />
              </ToolbarGroup>
            </Toolbar>
          }
          statusbar={
            <div className="flex items-center justify-between gap-3">
              <span>1 slide</span>
              <span>{hasUnsavedChanges ? t.unsavedChanges : t.saved}</span>
            </div>
          }
        >
          <div className="grid h-full min-h-0 gap-3 lg:grid-cols-[minmax(18rem,0.78fr)_minmax(24rem,1.22fr)] xl:grid-cols-[minmax(24rem,0.85fr)_minmax(36rem,1.35fr)]">
            <textarea
              className="editor-markdown-textarea h-full min-h-0 resize-none rounded-lg border border-ufoo-panel-border p-4 font-mono text-sm leading-6 outline-ufoo-neon"
              onKeyDown={(event) => insertTextareaTab(event, setMarkdown)}
              onChange={(event) => setMarkdown(event.target.value)}
              spellCheck={false}
              value={markdown}
            />
            <InspectorPanel className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-ufoo-panel-border bg-[#15171d] text-white" title={t.preview}>
              <InspectorSection className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden" title={t.sharedSlidesTab}>
                <SlidePreview
                  className="editor-slide-preview h-full min-h-0"
                  editableMedia
                  frameClassName="editor-slide-preview-frame"
                  hideControls
                  markdown={markdown}
                  onActiveSlideMarkdownChange={setMarkdown}
                />
              </InspectorSection>
            </InspectorPanel>
          </div>
        </EditorShell>
      </main>
      {error || status || invalidSlideCount ? (
        <div className="pointer-events-none fixed bottom-4 right-4 z-60 grid w-[calc(100vw-2rem)] max-w-sm gap-2">
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
          {invalidSlideCount ? (
            <p className="pointer-events-auto rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900 shadow-2xl">
              {t.sharedSlideSeparatorWarning}
            </p>
          ) : null}
        </div>
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
    </>
  );
}

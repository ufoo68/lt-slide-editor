"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@heroui/react";
import { Header } from "@/components/Header";
import { LoadingBlock } from "@/components/LoadingBlock";
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
        <main className="mx-auto max-w-4xl px-4 py-8">
          <LoadingBlock label={slideLoading ? t.sharedSlideLoading : t.authChecking} />
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
          <div className="flex gap-2">
            <Button variant="outline" onPress={() => setMediaOpen(true)}>
              {t.mediaTab}
            </Button>
            <Button
              isDisabled={busy || !title.trim() || !markdown.trim() || invalidSlideCount || !hasUnsavedChanges}
              variant="primary"
              onPress={saveSlide}
            >
              {t.save}
            </Button>
          </div>
        </div>

        {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {status ? <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{status}</p> : null}
        {invalidSlideCount ? (
          <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">{t.sharedSlideSeparatorWarning}</p>
        ) : null}

        <section className="grid min-h-0 flex-1 items-start gap-4 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_minmax(24rem,1fr)] lg:items-stretch lg:overflow-hidden">
          <div className="flex min-h-0 flex-col gap-3 lg:h-full">
            <div className="flex items-center justify-between">
              <h1 className="text-sm font-black uppercase tracking-normal text-stone-600">Markdown</h1>
              <span className="text-sm font-semibold text-stone-600">1 slide</span>
            </div>
            <textarea
              className="min-h-[24rem] resize-none rounded-lg border border-line bg-[#fffdf8] p-4 font-mono text-sm leading-6 outline-mint lg:min-h-0 lg:flex-1"
              onKeyDown={(event) => insertTextareaTab(event, setMarkdown)}
              onChange={(event) => setMarkdown(event.target.value)}
              spellCheck={false}
              value={markdown}
            />
          </div>
          <aside className="grid min-h-0 gap-4 lg:h-full lg:content-start">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-normal text-stone-600">{t.preview}</h2>
                <span className="text-sm font-semibold text-stone-600">{t.sharedSlidesTab}</span>
              </div>
              <SlidePreview editableMedia markdown={markdown} onActiveSlideMarkdownChange={setMarkdown} />
            </div>
          </aside>
        </section>
      </main>
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
                      {t.addToSharedSlide}
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
    </>
  );
}

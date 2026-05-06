"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { LoadingBlock } from "@/components/LoadingBlock";
import { SlidePreview } from "@/components/SlidePreview";
import { useAuth } from "@/components/AuthProvider";
import { splitSlides } from "@/lib/markdown";
import { insertTextareaTab } from "@/lib/textarea";

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

type ImageLibraryItem = {
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
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [images, setImages] = useState<ImageLibraryItem[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
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
          setError("共有スライドを読み込めませんでした");
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
        setError("共有スライドを読み込めませんでした");
      } finally {
        setSlideLoading(false);
      }
    }
    loadSlide();
  }, [mode, params.id, token, user]);

  useEffect(() => {
    async function loadImages() {
      if (!user || !imageOpen || imageLoaded) return;
      setImageError(null);
      setImageLoading(true);
      try {
        const idToken = await token();
        const response = await fetch("/api/images", {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!response.ok) {
          setImageError("画像ライブラリを読み込めませんでした");
          return;
        }
        const data = (await response.json()) as { images: ImageLibraryItem[] };
        setImages(data.images);
        setImageLoaded(true);
      } catch {
        setImageError("画像ライブラリを読み込めませんでした");
      } finally {
        setImageLoading(false);
      }
    }
    loadImages();
  }, [imageLoaded, imageOpen, token, user]);

  function imageMarkdownWithLayout(image: ImageLibraryItem) {
    return image.markdown.replace(/\)$/, ' "lt-image:x=29;y=33;w=42;h=34")');
  }

  function insertImage(image: ImageLibraryItem) {
    const imageMarkdown = imageMarkdownWithLayout(image);
    const separator = markdown.trim() ? "\n\n" : "";
    setMarkdown(`${markdown}${separator}${imageMarkdown}`);
    setImageOpen(false);
    setStatus(`「${image.filename}」を共有スライドに追加しました`);
  }

  async function uploadAndInsertImage(file: File | null) {
    if (!file) return;
    setUploadingImage(true);
    setImageError(null);
    try {
      const idToken = await token();
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch("/api/images", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
        body: formData,
      });
      if (!response.ok) {
        throw new Error("画像をアップロードできませんでした");
      }
      const data = (await response.json()) as { image: ImageLibraryItem };
      setImages((currentImages) => [data.image, ...currentImages]);
      setImageLoaded(true);
      insertImage(data.image);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "画像をアップロードできませんでした");
    } finally {
      setUploadingImage(false);
    }
  }

  async function copyImageMarkdown(image: ImageLibraryItem) {
    setImageError(null);
    try {
      await navigator.clipboard.writeText(imageMarkdownWithLayout(image));
      setStatus(`「${image.filename}」のMarkdownをコピーしました`);
    } catch {
      setImageError("クリップボードにコピーできませんでした");
    }
  }

  async function saveSlide() {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      if (invalidSlideCount) {
        throw new Error("共有スライドは1ページだけ保存できます");
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
        throw new Error("共有スライドを保存できませんでした");
      }
      const data = (await response.json()) as { slide: LibrarySlide };
      setTitle(data.slide.title);
      setMarkdown(data.slide.markdown);
      setSavedState({
        markdown: data.slide.markdown,
        title: data.slide.title,
      });
      setStatus("保存しました");
      if (mode === "new") {
        router.replace(`/shared-slides/${data.slide.id}/edit`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "共有スライドを保存できませんでした");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user || slideLoading) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-4xl px-4 py-8">
          <LoadingBlock label={slideLoading ? "共有スライドを読み込み中..." : "認証を確認中..."} />
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="mx-auto grid max-w-7xl gap-4 px-4 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <Link className="text-sm font-semibold text-steel" href="/dashboard">
              Dashboard
            </Link>
            <input
              className="mt-1 block w-full min-w-[18rem] bg-transparent text-2xl font-black outline-none"
              onChange={(event) => setTitle(event.target.value)}
              value={title}
            />
          </div>
          <div className="flex gap-2">
            <button
              className="h-10 rounded-md border border-line bg-white px-4 font-semibold"
              onClick={() => setImageOpen(true)}
              type="button"
            >
              画像
            </button>
            <button
              className="h-10 rounded-md bg-mint px-4 font-semibold text-white disabled:opacity-50"
              disabled={busy || !title.trim() || !markdown.trim() || invalidSlideCount || !hasUnsavedChanges}
              onClick={saveSlide}
              type="button"
            >
              保存
            </button>
          </div>
        </div>

        {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {status ? <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{status}</p> : null}
        {invalidSlideCount ? (
          <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">共有スライドは1ページだけです。区切り線 `---` は使えません。</p>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,1fr)]">
          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <h1 className="text-sm font-black uppercase tracking-normal text-stone-600">Markdown</h1>
              <span className="text-sm font-semibold text-stone-600">1 slide</span>
            </div>
            <textarea
              className="min-h-[68vh] resize-y rounded-lg border border-line bg-[#fffdf8] p-4 font-mono text-sm leading-6 outline-mint"
              onKeyDown={(event) => insertTextareaTab(event, setMarkdown)}
              onChange={(event) => setMarkdown(event.target.value)}
              spellCheck={false}
              value={markdown}
            />
          </div>
          <aside className="grid content-start gap-4">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-normal text-stone-600">Preview</h2>
                <span className="text-sm font-semibold text-stone-600">共有スライド</span>
              </div>
              <SlidePreview editableImages markdown={markdown} onActiveSlideMarkdownChange={setMarkdown} />
            </div>
          </aside>
        </section>
      </main>
      {imageOpen ? (
        <div className="fixed inset-0 z-40">
          <button
            aria-label="画像ライブラリを閉じる"
            className="absolute inset-0 bg-black/20"
            onClick={() => setImageOpen(false)}
            type="button"
          />
          <aside className="absolute right-0 top-0 grid h-full w-full max-w-md content-start gap-4 overflow-y-auto border-l border-line bg-paper p-5 shadow-panel">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-black">画像</h2>
              <button className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold" onClick={() => setImageOpen(false)} type="button">
                閉じる
              </button>
            </div>
            <label className="inline-flex cursor-pointer justify-center rounded-md bg-mint px-4 py-3 text-sm font-semibold text-white has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
              アップロードして共有スライドに追加
              <input
                accept="image/*"
                className="sr-only"
                disabled={uploadingImage}
                onChange={(event) => {
                  uploadAndInsertImage(event.target.files?.[0] ?? null);
                  event.currentTarget.value = "";
                }}
                type="file"
              />
            </label>
            {imageError ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{imageError}</p> : null}
            <div className="grid gap-2">
              {imageLoading ? <LoadingBlock label="画像を読み込み中..." /> : null}
              {!imageLoading && images.length ? (
                images.map((image) => (
                  <article className="rounded-md border border-line bg-white p-3" key={image.id}>
                    <div className="aspect-video overflow-hidden rounded-md border border-line bg-paper">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img alt={image.filename} className="h-full w-full object-contain" src={image.url} />
                    </div>
                    <h3 className="mt-3 truncate text-sm font-black">{image.filename}</h3>
                    <button
                      className="mt-3 h-9 w-full rounded-md bg-mint px-3 text-sm font-semibold text-white"
                      onClick={() => insertImage(image)}
                      type="button"
                    >
                      共有スライドに追加
                    </button>
                    <button
                      className="mt-2 h-9 w-full rounded-md border border-line bg-white px-3 text-sm font-semibold"
                      onClick={() => copyImageMarkdown(image)}
                      type="button"
                    >
                      Markdownをコピー
                    </button>
                  </article>
                ))
              ) : !imageLoading ? (
                <div className="rounded-md border border-dashed border-line bg-white p-4">
                  <p className="text-sm text-stone-600">画像はまだありません。</p>
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

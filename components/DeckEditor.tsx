"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Header } from "@/components/Header";
import { SlidePreview } from "@/components/SlidePreview";
import { analyzeDeck, joinEditableSlides, splitEditableSlides } from "@/lib/markdown";

type Deck = {
  id: string;
  title: string;
  slug: string;
  markdown: string;
  visibility: "private" | "public";
  updatedAt: string;
};

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

type DeckEditorProps = {
  mode: "new" | "edit";
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
  const [deck, setDeck] = useState<Deck | null>(null);
  const [title, setTitle] = useState(mode === "new" ? "新しいLT" : "");
  const [markdown, setMarkdown] = useState(mode === "new" ? initialMarkdown : "");
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [editMode, setEditMode] = useState<"page" | "full">("page");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [images, setImages] = useState<ImageLibraryItem[]>([]);
  const [librarySlides, setLibrarySlides] = useState<LibrarySlide[]>([]);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const slides = useMemo(() => splitEditableSlides(markdown), [markdown]);
  const warnings = useMemo(() => analyzeDeck(markdown), [markdown]);
  const slideCount = slides.length;
  const safeActiveSlideIndex = Math.min(activeSlideIndex, Math.max(slides.length - 1, 0));
  const activeSlideMarkdown = slides[safeActiveSlideIndex] ?? "";

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, router, user]);

  useEffect(() => {
    async function load() {
      if (!user || mode !== "edit" || !params.id) return;
      setError(null);
      const idToken = await token();
      const response = await fetch(`/api/presentations/${params.id}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!response.ok) {
        setError("デッキを読み込めませんでした");
        return;
      }
      const data = (await response.json()) as { deck: Deck };
      setDeck(data.deck);
      setTitle(data.deck.title);
      setMarkdown(data.deck.markdown);
      setActiveSlideIndex(0);
      setVisibility(data.deck.visibility);
    }
    load();
  }, [mode, params.id, token, user]);

  useEffect(() => {
    async function loadLibrary() {
      if (!user || !libraryOpen || libraryLoaded) return;
      setLibraryError(null);
      const idToken = await token();
      const response = await fetch("/api/shared-slides", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!response.ok) {
        setLibraryError("ライブラリを読み込めませんでした");
        return;
      }
      const data = (await response.json()) as { slides: LibrarySlide[] };
      setLibrarySlides(data.slides);
      setLibraryLoaded(true);
    }
    loadLibrary();
  }, [libraryLoaded, libraryOpen, token, user]);

  useEffect(() => {
    async function loadImages() {
      if (!user || !imageOpen || imageLoaded) return;
      setImageError(null);
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
    }
    loadImages();
  }, [imageLoaded, imageOpen, token, user]);

  async function copyLibrarySlide(slide: LibrarySlide) {
    setLibraryError(null);
    try {
      await navigator.clipboard.writeText(slide.markdown.trim());
      setStatus(`「${slide.title}」のMarkdownをコピーしました`);
    } catch {
      setLibraryError("クリップボードにコピーできませんでした");
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

  function imageMarkdownWithLayout(image: ImageLibraryItem) {
    return image.markdown.replace(/\)$/, ' "lt-image:x=29;y=33;w=42;h=34")');
  }

  function insertImage(image: ImageLibraryItem) {
    const imageMarkdown = imageMarkdownWithLayout(image);
    const separator = activeSlideMarkdown.trim() ? "\n\n" : "";
    updateActiveSlide(`${activeSlideMarkdown}${separator}${imageMarkdown}`);
    setImageOpen(false);
    setStatus(`「${image.filename}」を現在のページに追加しました`);
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
    setStatus("保存中...");
    setError(null);
    try {
      const idToken = await token();
      const response = await fetch(mode === "new" ? "/api/presentations" : `/api/presentations/${params.id}`, {
        method: mode === "new" ? "POST" : "PUT",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title, markdown, visibility }),
      });
      if (!response.ok) {
        throw new Error("保存に失敗しました");
      }
      const data = (await response.json()) as { deck: Deck };
      setDeck(data.deck);
      setStatus("保存しました");
      if (mode === "new") {
        router.replace(`/presentations/${data.deck.id}/edit`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) {
    return <main className="p-6">Loading...</main>;
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
          <div className="flex flex-wrap items-center gap-2">
            {deck?.visibility === "public" ? (
              <Link className="rounded-md border border-line px-3 py-2 text-sm font-semibold" href={`/view/${deck.slug}`} target="_blank">
                公開URLを開く
              </Link>
            ) : null}
            <label className="flex h-10 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-semibold">
              <input
                checked={visibility === "public"}
                onChange={(event) => setVisibility(event.target.checked ? "public" : "private")}
                type="checkbox"
              />
              公開
            </label>
            <button
              className="h-10 rounded-md border border-line bg-white px-4 font-semibold"
              onClick={() => setImageOpen(true)}
              type="button"
            >
              画像
            </button>
            <button
              className="h-10 rounded-md border border-line bg-white px-4 font-semibold"
              onClick={() => setLibraryOpen(true)}
              type="button"
            >
              共有スライド
            </button>
            <button
              className="h-10 rounded-md bg-mint px-4 font-semibold text-white disabled:opacity-50"
              disabled={busy || !title.trim()}
              onClick={save}
              type="button"
            >
              保存
            </button>
          </div>
        </div>

        {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {status ? <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{status}</p> : null}

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,1fr)]">
          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <h1 className="text-sm font-black uppercase tracking-normal text-stone-600">Markdown</h1>
              <span className="text-sm font-semibold text-stone-600">
                {editMode === "page" ? `${safeActiveSlideIndex + 1} / ${slideCount}` : `${slideCount} slides`}
              </span>
            </div>
            <div className="flex rounded-md border border-line bg-white p-1">
              <button
                className={`h-10 flex-1 rounded px-3 text-sm font-semibold ${editMode === "page" ? "bg-ink text-white" : ""}`}
                onClick={() => setEditMode("page")}
                type="button"
              >
                ページ編集
              </button>
              <button
                className={`h-10 flex-1 rounded px-3 text-sm font-semibold ${editMode === "full" ? "bg-ink text-white" : ""}`}
                onClick={() => setEditMode("full")}
                type="button"
              >
                Full Markdown
              </button>
            </div>
            {editMode === "page" ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-2">
                  <button
                    className="h-10 rounded-md border border-line bg-white px-3 text-sm font-semibold disabled:opacity-40"
                    disabled={safeActiveSlideIndex === 0}
                    onClick={goPreviousSlide}
                    type="button"
                  >
                    前のページへ
                  </button>
                  <button className="h-10 rounded-md border border-line bg-white px-3 text-sm font-semibold" onClick={goNextSlide} type="button">
                    次のページへ
                  </button>
                </div>
                <button className="h-10 rounded-md border border-line bg-white px-3 text-sm font-semibold" onClick={deleteActiveSlide} type="button">
                  このページを削除
                </button>
              </div>
            ) : null}
            {editMode === "page" ? (
              <textarea
                className="min-h-[68vh] resize-y rounded-lg border border-line bg-[#fffdf8] p-4 font-mono text-sm leading-6 outline-mint"
                onChange={(event) => updateActiveSlide(event.target.value)}
                spellCheck={false}
                value={activeSlideMarkdown}
              />
            ) : (
              <textarea
                className="min-h-[68vh] resize-y rounded-lg border border-line bg-[#fffdf8] p-4 font-mono text-sm leading-6 outline-mint"
                onChange={(event) => setMarkdown(event.target.value)}
                spellCheck={false}
                value={markdown}
              />
            )}
          </div>
          <aside className="grid content-start gap-4">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-normal text-stone-600">Preview</h2>
                <span className="text-sm font-semibold text-stone-600">ページ: {safeActiveSlideIndex + 1}</span>
              </div>
              <SlidePreview
                activeIndex={safeActiveSlideIndex}
                editableImages={editMode === "page"}
                markdown={markdown}
                onActiveIndexChange={setActiveSlideIndex}
                onActiveSlideMarkdownChange={updateActiveSlide}
              />
            </div>
            <div className="rounded-lg border border-line bg-white p-4">
              <h2 className="mb-3 text-sm font-black uppercase tracking-normal text-stone-600">LTチェック</h2>
              {warnings.length ? (
                <ul className="grid gap-2">
                  {warnings.map((warning, index) => (
                    <li className="rounded-md bg-amber-50 p-3 text-sm text-amber-900" key={`${warning.message}-${index}`}>
                      {warning.slideIndex ? `Slide ${warning.slideIndex}: ` : ""}
                      {warning.message}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-stone-600">今のところ大きな警告はありません。</p>
              )}
            </div>
          </aside>
        </section>
      </main>
      {libraryOpen ? (
        <div className="fixed inset-0 z-40">
          <button
            aria-label="共有スライドを閉じる"
            className="absolute inset-0 bg-black/20"
            onClick={() => setLibraryOpen(false)}
            type="button"
          />
          <aside className="absolute right-0 top-0 grid h-full w-full max-w-md content-start gap-4 overflow-y-auto border-l border-line bg-paper p-5 shadow-panel">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-black">共有スライド</h2>
              <button className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold" onClick={() => setLibraryOpen(false)} type="button">
                閉じる
              </button>
            </div>
            <Link className="rounded-md bg-ink px-4 py-3 text-center text-sm font-semibold text-white" href="/shared-slides/new">
              共有スライド作成
            </Link>
            {libraryError ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{libraryError}</p> : null}
            <div className="grid gap-2">
              {librarySlides.length ? (
                librarySlides.map((slide) => (
                  <article className="rounded-md border border-line bg-white p-3" key={slide.id}>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-black">{slide.title}</h3>
                      <p className="mt-1 text-xs text-stone-600">{slide.markdown.split("\n").slice(0, 2).join(" ").slice(0, 120)}</p>
                    </div>
                    <button
                      className="mt-3 h-9 w-full rounded-md bg-mint px-3 text-sm font-semibold text-white"
                      onClick={() => copyLibrarySlide(slide)}
                      type="button"
                    >
                      Markdownをコピー
                    </button>
                  </article>
                ))
              ) : (
                <div className="rounded-md border border-dashed border-line bg-white p-4">
                  <p className="text-sm text-stone-600">共有スライドはまだありません。</p>
                </div>
              )}
            </div>
          </aside>
        </div>
      ) : null}
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
            <Link className="rounded-md bg-ink px-4 py-3 text-center text-sm font-semibold text-white" href="/dashboard">
              画像ライブラリを開く
            </Link>
            {imageError ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{imageError}</p> : null}
            <div className="grid gap-2">
              {images.length ? (
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
                      現在のページに追加
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
              ) : (
                <div className="rounded-md border border-dashed border-line bg-white p-4">
                  <p className="text-sm text-stone-600">画像はまだありません。</p>
                </div>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

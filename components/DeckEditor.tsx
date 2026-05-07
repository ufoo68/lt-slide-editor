"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Header } from "@/components/Header";
import { LoadingBlock } from "@/components/LoadingBlock";
import { PublicSlideshow } from "@/components/PublicSlideshow";
import { SlidePreview } from "@/components/SlidePreview";
import { analyzeDeck, joinEditableSlides, renderSlides, splitEditableSlides } from "@/lib/markdown";
import { insertTextareaTab } from "@/lib/textarea";

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

type SavedDeckState = {
  markdown: string;
  presentationMinutes: number;
  title: string;
  visibility: "private" | "public";
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
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [presentationPreviewOpen, setPresentationPreviewOpen] = useState(false);
  const [images, setImages] = useState<ImageLibraryItem[]>([]);
  const [librarySlides, setLibrarySlides] = useState<LibrarySlide[]>([]);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const slides = useMemo(() => splitEditableSlides(markdown), [markdown]);
  const presentationSlides = useMemo(
    () => renderSlides(markdown).map((slide) => ({ index: slide.index, html: slide.html })),
    [markdown],
  );
  const warnings = useMemo(() => analyzeDeck(markdown), [markdown]);
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
          setError("デッキを読み込めませんでした");
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
        setError("デッキを読み込めませんでした");
      } finally {
        setDeckLoading(false);
      }
    }
    load();
  }, [mode, params.id, token, user]);

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
          setLibraryError("ライブラリを読み込めませんでした");
          return;
        }
        const data = (await response.json()) as { slides: LibrarySlide[] };
        setLibrarySlides(data.slides);
        setLibraryLoaded(true);
      } catch {
        setLibraryError("ライブラリを読み込めませんでした");
      } finally {
        setLibraryLoading(false);
      }
    }
    loadLibrary();
  }, [libraryLoaded, libraryOpen, token, user]);

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

  async function copyLibrarySlide(slide: LibrarySlide) {
    setLibraryError(null);
    try {
      await navigator.clipboard.writeText(slide.markdown.trim());
      setStatus(`「${slide.title}」のMarkdownをコピーしました`);
    } catch {
      setLibraryError("クリップボードにコピーできませんでした");
    }
  }

  function insertLibrarySlideAfterCurrent(slide: LibrarySlide) {
    const nextSlides = [...slides];
    const insertIndex = safeActiveSlideIndex + 1;
    nextSlides.splice(insertIndex, 0, slide.markdown.trim());
    setMarkdown(joinEditableSlides(nextSlides));
    setActiveSlideIndex(insertIndex);
    setLibraryOpen(false);
    setStatus(`「${slide.title}」を次のページに追加しました`);
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
        throw new Error("保存に失敗しました");
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
      setStatus(removedEmptySlideCount ? `保存しました（空ページを${removedEmptySlideCount}件削除しました）` : "保存しました");
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

  if (loading || !user || deckLoading) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-4xl px-4 py-8">
          <LoadingBlock label={deckLoading ? "デッキを読み込み中..." : "認証を確認中..."} />
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
          <div className="flex flex-wrap items-center gap-2">
            {deck?.visibility === "public" ? (
              <Link className="rounded-md border border-line px-3 py-2 text-sm font-semibold" href={`/view/${deck.slug}`} target="_blank">
                公開URLを開く
              </Link>
            ) : null}
            <label className="flex h-10 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-semibold">
              発表時間
              <input
                className="h-8 w-16 rounded border border-line px-2 text-right outline-mint"
                max={180}
                min={1}
                onChange={(event) => setPresentationMinutes(Math.max(1, Math.min(180, Number(event.target.value) || 1)))}
                type="number"
                value={presentationMinutes}
              />
              分
            </label>
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
              disabled={busy || !title.trim() || !hasUnsavedChanges}
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
                  <button
                    className="h-10 rounded-md border border-line bg-white px-3 text-sm font-semibold disabled:opacity-40"
                    disabled={!activeSlideMarkdown.trim()}
                    onClick={goNextSlide}
                    type="button"
                  >
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
                onKeyDown={(event) => insertTextareaTab(event, updateActiveSlide)}
                onChange={(event) => updateActiveSlide(event.target.value)}
                spellCheck={false}
                value={activeSlideMarkdown}
              />
            ) : (
              <textarea
                className="min-h-[68vh] resize-y rounded-lg border border-line bg-[#fffdf8] p-4 font-mono text-sm leading-6 outline-mint"
                onKeyDown={(event) => insertTextareaTab(event, setMarkdown)}
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
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-stone-600">ページ: {safeActiveSlideIndex + 1}</span>
                  <button
                    className="h-9 rounded-md border border-line bg-white px-3 text-sm font-semibold"
                    onClick={() => setPresentationPreviewOpen(true)}
                    type="button"
                  >
                    発表表示
                  </button>
                </div>
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
              {libraryLoading ? <LoadingBlock label="共有スライドを読み込み中..." /> : null}
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
                      次のページに追加
                    </button>
                    <button
                      className="mt-2 h-9 w-full rounded-md border border-line bg-white px-3 text-sm font-semibold"
                      onClick={() => copyLibrarySlide(slide)}
                      type="button"
                    >
                      Markdownをコピー
                    </button>
                  </article>
                ))
              ) : !libraryLoading ? (
                <div className="rounded-md border border-dashed border-line bg-white p-4">
                  <p className="text-sm text-stone-600">共有スライドはまだありません。</p>
                </div>
              ) : null}
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
            <label className="inline-flex cursor-pointer justify-center rounded-md bg-mint px-4 py-3 text-sm font-semibold text-white has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
              アップロードして現在のページに追加
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
              ) : !imageLoading ? (
                <div className="rounded-md border border-dashed border-line bg-white p-4">
                  <p className="text-sm text-stone-600">画像はまだありません。</p>
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
            title={title || "Untitled"}
            updatedAt={deck ? new Date(deck.updatedAt).toLocaleDateString("ja-JP") : "編集中"}
          />
        </div>
      ) : null}
    </>
  );
}

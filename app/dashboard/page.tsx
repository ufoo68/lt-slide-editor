"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { LoadingBlock } from "@/components/LoadingBlock";
import { useAuth } from "@/components/AuthProvider";

type DeckSummary = {
  id: string;
  title: string;
  slug: string;
  visibility: "private" | "public";
  updatedAt: string;
};

type SharedSlideSummary = {
  id: string;
  title: string;
  markdown: string;
  updatedAt: string;
};

type ImageSummary = {
  id: string;
  filename: string;
  markdown: string;
  size: number;
  updatedAt: string;
  url: string;
};

type DashboardTab = "decks" | "images" | "shared";

function parseDashboardTab(value: string | null): DashboardTab {
  if (value === "images" || value === "shared") {
    return value;
  }
  return "decks";
}

function DashboardLoading() {
  return <main className="p-6">Loading...</main>;
}

function DashboardContent() {
  const { user, loading, token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = parseDashboardTab(searchParams.get("tab"));
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [images, setImages] = useState<ImageSummary[]>([]);
  const [sharedSlides, setSharedSlides] = useState<SharedSlideSummary[]>([]);
  const [copiedImageId, setCopiedImageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [listLoading, setListLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, router, user]);

  useEffect(() => {
    async function load() {
      if (!user) return;
      setError(null);
      setListLoading(true);
      try {
        const idToken = await token();
        const [deckResponse, imageResponse, sharedSlideResponse] = await Promise.all([
          fetch("/api/presentations", {
            headers: { Authorization: `Bearer ${idToken}` },
          }),
          fetch("/api/images", {
            headers: { Authorization: `Bearer ${idToken}` },
          }),
          fetch("/api/shared-slides", {
            headers: { Authorization: `Bearer ${idToken}` },
          }),
        ]);
        if (!deckResponse.ok || !imageResponse.ok || !sharedSlideResponse.ok) {
          setError("一覧を読み込めませんでした");
          return;
        }
        const deckData = (await deckResponse.json()) as { decks: DeckSummary[] };
        const imageData = (await imageResponse.json()) as { images: ImageSummary[] };
        const sharedSlideData = (await sharedSlideResponse.json()) as { slides: SharedSlideSummary[] };
        setDecks(deckData.decks);
        setImages(imageData.images);
        setSharedSlides(sharedSlideData.slides);
      } catch {
        setError("一覧を読み込めませんでした");
      } finally {
        setListLoading(false);
      }
    }
    load();
  }, [token, user]);

  async function deleteSharedSlide(id: string) {
    setBusy(true);
    setError(null);
    try {
      const idToken = await token();
      const response = await fetch(`/api/shared-slides/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!response.ok) {
        throw new Error("共有スライドを削除できませんでした");
      }
      setSharedSlides((slides) => slides.filter((slide) => slide.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "共有スライドを削除できませんでした");
    } finally {
      setBusy(false);
    }
  }

  async function deleteDeck(id: string) {
    setBusy(true);
    setError(null);
    try {
      const idToken = await token();
      const response = await fetch(`/api/presentations/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!response.ok) {
        throw new Error("発表用スライドを削除できませんでした");
      }
      setDecks((currentDecks) => currentDecks.filter((deck) => deck.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "発表用スライドを削除できませんでした");
    } finally {
      setBusy(false);
    }
  }

  async function uploadImage(file: File | null) {
    if (!file) return;
    setBusy(true);
    setError(null);
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
      const data = (await response.json()) as { image: ImageSummary };
      setImages((currentImages) => [data.image, ...currentImages]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "画像をアップロードできませんでした");
    } finally {
      setBusy(false);
    }
  }

  async function deleteImage(id: string) {
    setBusy(true);
    setError(null);
    try {
      const idToken = await token();
      const response = await fetch(`/api/images/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!response.ok) {
        throw new Error("画像を削除できませんでした");
      }
      setImages((currentImages) => currentImages.filter((image) => image.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "画像を削除できませんでした");
    } finally {
      setBusy(false);
    }
  }

  async function copyImageMarkdown(image: ImageSummary) {
    setError(null);
    try {
      await navigator.clipboard.writeText(image.markdown);
      setCopiedImageId(image.id);
      window.setTimeout(() => setCopiedImageId((currentId) => (currentId === image.id ? null : currentId)), 1200);
    } catch {
      setError("Markdownをコピーできませんでした");
    }
  }

  function changeTab(tab: DashboardTab) {
    const nextParams = new URLSearchParams(searchParams);
    if (tab === "decks") {
      nextParams.delete("tab");
    } else {
      nextParams.set("tab", tab);
    }
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `/dashboard?${nextQuery}` : "/dashboard", { scroll: false });
  }

  if (loading || !user) {
    return <main className="p-6">Loading...</main>;
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black">スライド一覧</h1>
            <p className="mt-1 text-sm text-stone-600">{user.email}</p>
          </div>
          <div>
            {activeTab === "shared" ? (
            <Link className="rounded-md border border-line bg-white px-4 py-3 font-semibold" href="/shared-slides/new">
              共有スライド作成
            </Link>
            ) : activeTab === "images" ? (
              <label className="inline-flex cursor-pointer rounded-md bg-mint px-4 py-3 font-semibold text-white">
                画像アップロード
                <input
                  accept="image/*"
                  className="sr-only"
                  disabled={busy}
                  onChange={(event) => uploadImage(event.target.files?.[0] ?? null)}
                  type="file"
                />
              </label>
            ) : (
            <Link className="rounded-md bg-mint px-4 py-3 font-semibold text-white" href="/presentations/new">
              新規作成
            </Link>
            )}
          </div>
        </div>
        <div className="mb-5 flex rounded-md border border-line bg-white p-1">
          <button
            className={`h-10 flex-1 rounded px-3 text-sm font-semibold ${activeTab === "decks" ? "bg-ink text-white" : ""}`}
            onClick={() => changeTab("decks")}
            type="button"
          >
            発表用スライド
          </button>
          <button
            className={`h-10 flex-1 rounded px-3 text-sm font-semibold ${activeTab === "images" ? "bg-ink text-white" : ""}`}
            onClick={() => changeTab("images")}
            type="button"
          >
            画像
          </button>
          <button
            className={`h-10 flex-1 rounded px-3 text-sm font-semibold ${activeTab === "shared" ? "bg-ink text-white" : ""}`}
            onClick={() => changeTab("shared")}
            type="button"
          >
            共有スライド
          </button>
        </div>
        {error ? <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {listLoading ? <LoadingBlock label="一覧を読み込み中..." /> : null}
        {!listLoading && activeTab === "decks" && decks.length ? (
          <div className="grid gap-3">
            {decks.map((deck) => (
              <article className="rounded-lg border border-line bg-white p-4 shadow-panel" key={deck.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black">{deck.title}</h2>
                    <p className="mt-1 text-sm text-stone-600">
                      {deck.visibility === "public" ? "公開" : "非公開"} / 更新:{" "}
                      {new Date(deck.updatedAt).toLocaleString("ja-JP")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {deck.visibility === "public" ? (
                      <Link className="rounded-md border border-line px-3 py-2 text-sm font-semibold" href={`/view/${deck.slug}`} target="_blank">
                        閲覧
                      </Link>
                    ) : null}
                    <button
                      className="rounded-md border border-line px-3 py-2 text-sm font-semibold disabled:opacity-50"
                      disabled={busy}
                      onClick={() => deleteDeck(deck.id)}
                      type="button"
                    >
                      削除
                    </button>
                    <Link className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white" href={`/presentations/${deck.id}/edit`}>
                      編集
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}
        {!listLoading && activeTab === "decks" && !decks.length ? (
          <div className="rounded-lg border border-dashed border-line bg-white p-10 text-center">
            <p className="mb-4 font-semibold text-stone-700">まだデッキがありません。</p>
            <Link className="rounded-md bg-mint px-4 py-3 font-semibold text-white" href="/presentations/new">
              最初のデッキを作成
            </Link>
          </div>
        ) : null}
        {!listLoading && activeTab === "images" && images.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((image) => (
              <article className="rounded-lg border border-line bg-white p-4 shadow-panel" key={image.id}>
                <div className="aspect-video overflow-hidden rounded-md border border-line bg-paper">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt={image.filename} className="h-full w-full object-contain" src={image.url} />
                </div>
                <h2 className="mt-3 truncate text-base font-black">{image.filename}</h2>
                <p className="mt-1 text-sm text-stone-600">{Math.ceil(image.size / 1024)} KB</p>
                <div className="mt-3 flex items-center rounded-md bg-stone-100">
                  <code className="min-w-0 flex-1 truncate p-2 text-xs">{image.markdown}</code>
                  <button
                    aria-label={`${image.filename} のMarkdownをコピー`}
                    className="mr-1 grid h-8 w-8 place-items-center rounded border border-transparent text-stone-600 hover:border-line hover:bg-white hover:text-ink"
                    onClick={() => copyImageMarkdown(image)}
                    title="Markdownをコピー"
                    type="button"
                  >
                    {copiedImageId === image.id ? (
                      <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    ) : (
                      <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                        <rect height="14" rx="2" width="14" x="8" y="8" />
                        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                      </svg>
                    )}
                  </button>
                </div>
                <button
                  className="mt-3 rounded-md border border-line px-3 py-2 text-sm font-semibold disabled:opacity-50"
                  disabled={busy}
                  onClick={() => deleteImage(image.id)}
                  type="button"
                >
                  削除
                </button>
              </article>
            ))}
          </div>
        ) : null}
        {!listLoading && activeTab === "images" && !images.length ? (
          <div className="rounded-lg border border-dashed border-line bg-white p-10 text-center">
            <p className="mb-4 font-semibold text-stone-700">画像はまだありません。</p>
            <label className="inline-flex cursor-pointer rounded-md bg-mint px-4 py-3 font-semibold text-white">
              最初の画像をアップロード
              <input
                accept="image/*"
                className="sr-only"
                disabled={busy}
                onChange={(event) => uploadImage(event.target.files?.[0] ?? null)}
                type="file"
              />
            </label>
          </div>
        ) : null}
        {!listLoading && activeTab === "shared" && sharedSlides.length ? (
          <div className="grid gap-3">
            {sharedSlides.map((slide) => (
              <article className="rounded-lg border border-line bg-white p-4 shadow-panel" key={slide.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-xl font-black">{slide.title}</h2>
                    <p className="mt-1 text-sm text-stone-600">
                      更新: {new Date(slide.updatedAt).toLocaleString("ja-JP")}
                    </p>
                    <p className="mt-2 truncate text-sm text-stone-600">{slide.markdown.split("\n").slice(0, 2).join(" ")}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="rounded-md border border-line px-3 py-2 text-sm font-semibold disabled:opacity-50"
                      disabled={busy}
                      onClick={() => deleteSharedSlide(slide.id)}
                      type="button"
                    >
                      削除
                    </button>
                    <Link className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white" href={`/shared-slides/${slide.id}/edit`}>
                      編集
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}
        {!listLoading && activeTab === "shared" && !sharedSlides.length ? (
          <div className="rounded-lg border border-dashed border-line bg-white p-10 text-center">
            <p className="mb-4 font-semibold text-stone-700">共有スライドはまだありません。</p>
            <Link className="rounded-md bg-mint px-4 py-3 font-semibold text-white" href="/shared-slides/new">
              共有スライドを作成
            </Link>
          </div>
        ) : null}
      </main>
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardContent />
    </Suspense>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
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

export default function DashboardPage() {
  const { user, loading, token } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"decks" | "shared">("decks");
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [sharedSlides, setSharedSlides] = useState<SharedSlideSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, router, user]);

  useEffect(() => {
    async function load() {
      if (!user) return;
      const idToken = await token();
      setError(null);
      const [deckResponse, sharedSlideResponse] = await Promise.all([
        fetch("/api/decks", {
          headers: { Authorization: `Bearer ${idToken}` },
        }),
        fetch("/api/slide-library", {
          headers: { Authorization: `Bearer ${idToken}` },
        }),
      ]);
      if (!deckResponse.ok || !sharedSlideResponse.ok) {
        setError("一覧を読み込めませんでした");
        return;
      }
      const deckData = (await deckResponse.json()) as { decks: DeckSummary[] };
      const sharedSlideData = (await sharedSlideResponse.json()) as { slides: SharedSlideSummary[] };
      setDecks(deckData.decks);
      setSharedSlides(sharedSlideData.slides);
    }
    load();
  }, [token, user]);

  async function deleteSharedSlide(id: string) {
    setBusy(true);
    setError(null);
    try {
      const idToken = await token();
      const response = await fetch(`/api/slide-library/${id}`, {
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
          <div className="flex flex-wrap gap-2">
            <Link className="rounded-md border border-line bg-white px-4 py-3 font-semibold" href="/slides/new">
              共有スライド作成
            </Link>
            <Link className="rounded-md bg-mint px-4 py-3 font-semibold text-white" href="/decks/new">
              新規作成
            </Link>
          </div>
        </div>
        <div className="mb-5 flex rounded-md border border-line bg-white p-1">
          <button
            className={`h-10 flex-1 rounded px-3 text-sm font-semibold ${activeTab === "decks" ? "bg-ink text-white" : ""}`}
            onClick={() => setActiveTab("decks")}
            type="button"
          >
            発表用スライド
          </button>
          <button
            className={`h-10 flex-1 rounded px-3 text-sm font-semibold ${activeTab === "shared" ? "bg-ink text-white" : ""}`}
            onClick={() => setActiveTab("shared")}
            type="button"
          >
            共有スライド
          </button>
        </div>
        {error ? <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {activeTab === "decks" && decks.length ? (
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
                      <Link className="rounded-md border border-line px-3 py-2 text-sm font-semibold" href={`/p/${deck.slug}`} target="_blank">
                        閲覧
                      </Link>
                    ) : null}
                    <Link className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white" href={`/decks/${deck.id}/edit`}>
                      編集
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}
        {activeTab === "decks" && !decks.length ? (
          <div className="rounded-lg border border-dashed border-line bg-white p-10 text-center">
            <p className="mb-4 font-semibold text-stone-700">まだデッキがありません。</p>
            <Link className="rounded-md bg-mint px-4 py-3 font-semibold text-white" href="/decks/new">
              最初のデッキを作成
            </Link>
          </div>
        ) : null}
        {activeTab === "shared" && sharedSlides.length ? (
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
                    <Link className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white" href={`/slides/${slide.id}/edit`}>
                      編集
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}
        {activeTab === "shared" && !sharedSlides.length ? (
          <div className="rounded-lg border border-dashed border-line bg-white p-10 text-center">
            <p className="mb-4 font-semibold text-stone-700">共有スライドはまだありません。</p>
            <Link className="rounded-md bg-mint px-4 py-3 font-semibold text-white" href="/slides/new">
              共有スライドを作成
            </Link>
          </div>
        ) : null}
      </main>
    </>
  );
}

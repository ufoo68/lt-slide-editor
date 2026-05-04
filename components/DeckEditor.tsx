"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Header } from "@/components/Header";
import { SlidePreview } from "@/components/SlidePreview";
import { analyzeDeck, renderSlides } from "@/lib/markdown";

type Deck = {
  id: string;
  title: string;
  slug: string;
  markdown: string;
  visibility: "private" | "public";
  updatedAt: string;
};

export function DeckEditor() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading, token } = useAuth();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const warnings = useMemo(() => analyzeDeck(markdown), [markdown]);
  const slideCount = useMemo(() => renderSlides(markdown).length, [markdown]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, router, user]);

  useEffect(() => {
    async function load() {
      if (!user) return;
      setError(null);
      const idToken = await token();
      const response = await fetch(`/api/decks/${params.id}`, {
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
      setVisibility(data.deck.visibility);
    }
    load();
  }, [params.id, token, user]);

  async function save() {
    setStatus("保存中...");
    setError(null);
    try {
      const idToken = await token();
      const response = await fetch(`/api/decks/${params.id}`, {
        method: "PUT",
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
      setStatus(null);
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
              <Link className="rounded-md border border-line px-3 py-2 text-sm font-semibold" href={`/p/${deck.slug}`} target="_blank">
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
            <button className="h-10 rounded-md bg-mint px-4 font-semibold text-white" onClick={save} type="button">
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
              <span className="text-sm font-semibold text-stone-600">{slideCount} slides</span>
            </div>
            <textarea
              className="min-h-[68vh] resize-y rounded-lg border border-line bg-[#fffdf8] p-4 font-mono text-sm leading-6 outline-mint"
              onChange={(event) => setMarkdown(event.target.value)}
              spellCheck={false}
              value={markdown}
            />
          </div>
          <aside className="grid content-start gap-4">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-normal text-stone-600">Preview</h2>
                <span className="text-sm font-semibold text-stone-600">区切り: ---</span>
              </div>
              <SlidePreview markdown={markdown} />
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
    </>
  );
}

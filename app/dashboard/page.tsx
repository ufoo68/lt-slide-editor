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

export default function DashboardPage() {
  const { user, loading, token } = useAuth();
  const router = useRouter();
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, router, user]);

  useEffect(() => {
    async function load() {
      if (!user) return;
      const idToken = await token();
      const response = await fetch("/api/decks", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!response.ok) {
        setError("デッキ一覧を読み込めませんでした");
        return;
      }
      const data = (await response.json()) as { decks: DeckSummary[] };
      setDecks(data.decks);
    }
    load();
  }, [token, user]);

  if (loading || !user) {
    return <main className="p-6">Loading...</main>;
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black">デッキ一覧</h1>
            <p className="mt-1 text-sm text-stone-600">{user.email}</p>
          </div>
          <Link className="rounded-md bg-mint px-4 py-3 font-semibold text-white" href="/decks/new">
            新規作成
          </Link>
        </div>
        {error ? <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {decks.length ? (
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
        ) : (
          <div className="rounded-lg border border-dashed border-line bg-white p-10 text-center">
            <p className="mb-4 font-semibold text-stone-700">まだデッキがありません。</p>
            <Link className="rounded-md bg-mint px-4 py-3 font-semibold text-white" href="/decks/new">
              最初のデッキを作成
            </Link>
          </div>
        )}
      </main>
    </>
  );
}

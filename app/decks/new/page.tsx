"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { useAuth } from "@/components/AuthProvider";

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

export default function NewDeckPage() {
  const { user, loading, token } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState("新しいLT");
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, router, user]);

  async function createDeck() {
    setBusy(true);
    setError(null);
    try {
      const idToken = await token();
      const response = await fetch("/api/decks", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title, markdown }),
      });
      if (!response.ok) {
        throw new Error("デッキ作成に失敗しました");
      }
      const data = (await response.json()) as { deck: { id: string } };
      router.push(`/decks/${data.deck.id}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "デッキ作成に失敗しました");
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
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-6 text-3xl font-black">新規デッキ作成</h1>
        {error ? <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        <div className="grid gap-4">
          <label className="grid gap-1 text-sm font-semibold">
            タイトル
            <input
              className="h-12 rounded-md border border-line bg-white px-3 text-base"
              onChange={(event) => setTitle(event.target.value)}
              value={title}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Markdown
            <textarea
              className="min-h-[24rem] rounded-md border border-line bg-white p-4 font-mono text-sm leading-6"
              onChange={(event) => setMarkdown(event.target.value)}
              value={markdown}
            />
          </label>
          <button
            className="h-12 rounded-md bg-mint px-5 font-semibold text-white disabled:opacity-50"
            disabled={busy || !title.trim()}
            onClick={createDeck}
            type="button"
          >
            作成して編集へ
          </button>
        </div>
      </main>
    </>
  );
}

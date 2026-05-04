"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
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

type LibrarySlide = {
  id: string;
  title: string;
  markdown: string;
  updatedAt: string;
};

function currentSlide(markdown: string, caret: number) {
  const separator = /\n---\s*(?:\n|$)/g;
  let start = 0;
  let end = markdown.length;
  let match: RegExpExecArray | null;

  while ((match = separator.exec(markdown))) {
    if (match.index < caret) {
      start = separator.lastIndex;
      continue;
    }

    end = match.index;
    break;
  }

  return {
    end,
    markdown: markdown.slice(start, end).trim(),
  };
}

function insertAfterSlide(markdown: string, caret: number, slideMarkdown: string) {
  const slide = currentSlide(markdown, caret);
  const before = markdown.slice(0, slide.end).trimEnd();
  const after = markdown.slice(slide.end).trimStart();
  const reusableSlide = slideMarkdown.trim();

  if (!before) {
    return after ? `${reusableSlide}\n\n---\n\n${after}` : reusableSlide;
  }

  return `${before}\n\n---\n\n${reusableSlide}${after ? `\n\n${after}` : ""}`;
}

export function DeckEditor() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading, token } = useAuth();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [caret, setCaret] = useState(0);
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [librarySlides, setLibrarySlides] = useState<LibrarySlide[]>([]);
  const [libraryError, setLibraryError] = useState<string | null>(null);
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
      setCaret(0);
      setVisibility(data.deck.visibility);
    }
    load();
  }, [params.id, token, user]);

  useEffect(() => {
    async function loadLibrary() {
      if (!user) return;
      setLibraryError(null);
      const idToken = await token();
      const response = await fetch("/api/slide-library", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!response.ok) {
        setLibraryError("ライブラリを読み込めませんでした");
        return;
      }
      const data = (await response.json()) as { slides: LibrarySlide[] };
      setLibrarySlides(data.slides);
    }
    loadLibrary();
  }, [token, user]);

  function syncCaret() {
    const textarea = textareaRef.current;
    if (textarea) {
      setCaret(textarea.selectionStart);
    }
  }

  function insertLibrarySlide(slide: LibrarySlide) {
    const nextMarkdown = insertAfterSlide(markdown, caret, slide.markdown);
    setMarkdown(nextMarkdown);
    setStatus("ライブラリのスライドを挿入しました");
  }

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
              ref={textareaRef}
              className="min-h-[68vh] resize-y rounded-lg border border-line bg-[#fffdf8] p-4 font-mono text-sm leading-6 outline-mint"
              onChange={(event) => {
                setMarkdown(event.target.value);
                setCaret(event.target.selectionStart);
              }}
              onClick={syncCaret}
              onKeyUp={syncCaret}
              onSelect={syncCaret}
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
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-black uppercase tracking-normal text-stone-600">共有スライド</h2>
                <Link className="text-sm font-semibold text-steel" href="/slides/new">
                  作成
                </Link>
              </div>
              {libraryError ? <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{libraryError}</p> : null}
              <div className="grid gap-2">
                {librarySlides.length ? (
                  librarySlides.map((slide) => (
                    <article className="rounded-md border border-line p-3" key={slide.id}>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-black">{slide.title}</h3>
                        <p className="mt-1 text-xs text-stone-600">{slide.markdown.split("\n").slice(0, 2).join(" ").slice(0, 90)}</p>
                      </div>
                      <button
                        className="mt-3 h-9 w-full rounded-md bg-mint px-3 text-sm font-semibold text-white"
                        onClick={() => insertLibrarySlide(slide)}
                        type="button"
                      >
                        現在のスライドの後ろに挿入
                      </button>
                    </article>
                  ))
                ) : (
                  <div className="rounded-md border border-dashed border-line p-4">
                    <p className="text-sm text-stone-600">共有スライドはまだありません。</p>
                    <Link className="mt-3 inline-flex rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white" href="/slides/new">
                      共有スライド作成
                    </Link>
                  </div>
                )}
              </div>
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

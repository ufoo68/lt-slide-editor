"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button, Card, Chip, Tabs, Tooltip } from "ufoo-ui";
import { Header } from "@/components/Header";
import { LoadingBlock } from "@/components/LoadingBlock";
import { useAuth } from "@/components/AuthProvider";
import { useLanguage } from "@/lib/i18n";

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

type MediaSummary = {
  contentType: string;
  id: string;
  filename: string;
  markdown: string;
  size: number;
  updatedAt: string;
  url: string;
};

type DashboardTab = "decks" | "media" | "shared";

function parseDashboardTab(value: string | null): DashboardTab {
  if (value === "media" || value === "shared") {
    return value;
  }
  return "decks";
}

function DashboardLoading() {
  const { t } = useLanguage();
  return <main className="p-6">{t.loading}</main>;
}

function DashboardContent() {
  const { user, loading, token } = useAuth();
  const { language, t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = parseDashboardTab(searchParams.get("tab"));
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [media, setMedia] = useState<MediaSummary[]>([]);
  const [sharedSlides, setSharedSlides] = useState<SharedSlideSummary[]>([]);
  const [copiedMediaId, setCopiedMediaId] = useState<string | null>(null);
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
        const [deckResponse, mediaResponse, sharedSlideResponse] = await Promise.all([
          fetch("/api/presentations", {
            headers: { Authorization: `Bearer ${idToken}` },
          }),
          fetch("/api/media", {
            headers: { Authorization: `Bearer ${idToken}` },
          }),
          fetch("/api/shared-slides", {
            headers: { Authorization: `Bearer ${idToken}` },
          }),
        ]);
        if (!deckResponse.ok || !mediaResponse.ok || !sharedSlideResponse.ok) {
          setError(t.listLoadFailed);
          return;
        }
        const deckData = (await deckResponse.json()) as { decks: DeckSummary[] };
        const mediaData = (await mediaResponse.json()) as { media: MediaSummary[] };
        const sharedSlideData = (await sharedSlideResponse.json()) as { slides: SharedSlideSummary[] };
        setDecks(deckData.decks);
        setMedia(mediaData.media);
        setSharedSlides(sharedSlideData.slides);
      } catch {
        setError(t.listLoadFailed);
      } finally {
        setListLoading(false);
      }
    }
    load();
  }, [t, token, user]);

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
        throw new Error(t.sharedSlideDeleteFailed);
      }
      setSharedSlides((slides) => slides.filter((slide) => slide.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : t.sharedSlideDeleteFailed);
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
        throw new Error(t.deckDeleteFailed);
      }
      setDecks((currentDecks) => currentDecks.filter((deck) => deck.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : t.deckDeleteFailed);
    } finally {
      setBusy(false);
    }
  }

  async function uploadMedia(file: File | null) {
    if (!file) return;
    setBusy(true);
    setError(null);
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
      const data = (await response.json()) as { media: MediaSummary };
      setMedia((currentMedia) => [data.media, ...currentMedia]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.mediaUploadFailed);
    } finally {
      setBusy(false);
    }
  }

  async function deleteMedia(id: string) {
    setBusy(true);
    setError(null);
    try {
      const idToken = await token();
      const response = await fetch(`/api/media/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!response.ok) {
        throw new Error(t.mediaDeleteFailed);
      }
      setMedia((currentMedia) => currentMedia.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : t.mediaDeleteFailed);
    } finally {
      setBusy(false);
    }
  }

  async function copyMediaMarkdown(item: MediaSummary) {
    setError(null);
    try {
      await navigator.clipboard.writeText(item.markdown);
      setCopiedMediaId(item.id);
      window.setTimeout(() => setCopiedMediaId((currentId) => (currentId === item.id ? null : currentId)), 1200);
    } catch {
      setError(t.copyMarkdownFailed);
    }
  }

  function changeTab(tab: DashboardTab) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", tab);
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `/dashboard?${nextQuery}` : "/dashboard", { scroll: false });
  }

  if (loading || !user) {
    return <main className="p-6">{t.loading}</main>;
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-black sm:text-3xl">{t.decksTitle}</h1>
            <p className="mt-1 truncate text-sm text-stone-600">{user.email}</p>
          </div>
          <div className="flex w-full justify-stretch sm:w-auto sm:justify-end">
            {(() => {
              switch (activeTab) {
                case "decks":
                  return (
                    <Link className="w-full sm:w-auto" href="/presentations/new">
                      <Button className="w-full sm:w-auto" variant="primary">
                        {t.createDeck}
                      </Button>
                    </Link>
                  );
                case "shared":
                  return (
                    <Link className="w-full sm:w-auto" href="/shared-slides/new">
                      <Button className="w-full sm:w-auto" variant="primary">
                        {t.createSharedSlide}
                      </Button>
                    </Link>
                  );
                case "media":
                  return (
                    <label className="inline-flex w-full cursor-pointer justify-center rounded-md bg-mint px-4 py-2 text-sm font-semibold text-white shadow-sm sm:w-auto">
                      {t.uploadMedia}
                      <input
                        accept="image/*,video/*"
                        className="sr-only"
                        disabled={busy}
                        onChange={(event) =>
                          uploadMedia(event.target.files?.[0] ?? null)
                        }
                        type="file"
                      />
                    </label>
                  );
                default:
                  return (
                    <Link className="w-full sm:w-auto" href="/presentations/new">
                      <Button className="w-full sm:w-auto" variant="primary">
                        {t.createDeck}
                      </Button>
                    </Link>
                  );
              }
            })()}
          </div>
        </div>
        <Tabs
          aria-label={t.decksTitle}
          className="mb-5 overflow-x-auto"
          selectedKey={activeTab}
          onSelectionChange={(key) => changeTab(key as DashboardTab)}
        >
          <Tabs.List className="min-w-max rounded-md border border-line bg-white p-1">
            <Tabs.Tab className="rounded px-3 py-2 text-sm font-semibold" id="decks">
              {t.deckTab}
            </Tabs.Tab>
            <Tabs.Tab className="rounded px-3 py-2 text-sm font-semibold" id="shared">
              {t.sharedSlidesTab}
            </Tabs.Tab>
            <Tabs.Tab className="rounded px-3 py-2 text-sm font-semibold" id="media">
              {t.mediaTab}
            </Tabs.Tab>
          </Tabs.List>
        </Tabs>
        {error ? <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {listLoading ? <LoadingBlock label={t.loading} /> : null}
        {!listLoading && activeTab === "decks" && decks.length ? (
          <div className="grid gap-3">
            {decks.map((deck) => (
              <Card className="border border-line bg-white/90 shadow-panel" key={deck.id}>
                <Card.Content>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-black sm:text-xl">{deck.title}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-stone-600">
                      <Chip color={deck.visibility === "public" ? "accent" : "default"} size="sm" variant="soft">
                        {deck.visibility === "public" ? t.public : t.private}
                      </Chip>
                      <span>{t.updated}: {new Date(deck.updatedAt).toLocaleString(language === "ja" ? "ja-JP" : "en-US")}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                    {deck.visibility === "public" ? (
                      <Link href={`/view/${deck.slug}`} target="_blank">
                        <Button className="w-full sm:w-auto" size="sm" variant="outline">{t.view}</Button>
                      </Link>
                    ) : null}
                    <Button
                      className="w-full sm:w-auto"
                      isDisabled={busy}
                      size="sm"
                      variant="outline"
                      onPress={() => deleteDeck(deck.id)}
                    >
                      {t.delete}
                    </Button>
                    <Link href={`/presentations/${deck.id}/edit`}>
                      <Button className="w-full sm:w-auto" size="sm" variant="primary">{t.edit}</Button>
                    </Link>
                  </div>
                </div>
                </Card.Content>
              </Card>
            ))}
          </div>
        ) : null}
        {!listLoading && activeTab === "decks" && !decks.length ? (
          <Card className="border border-dashed border-line bg-white/80">
            <Card.Content className="items-center p-6 text-center sm:p-10">
            <p className="mb-4 font-semibold text-stone-700">{t.noDecks}</p>
            <Link href="/presentations/new">
              <Button variant="primary">{t.createDeck}</Button>
            </Link>
            </Card.Content>
          </Card>
        ) : null}
        {!listLoading && activeTab === "media" && media.length ? (
          <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {media.map((item) => (
              <Card className="h-full min-w-0 border border-line bg-white/90 shadow-panel" key={item.id}>
                <Card.Content className="h-full min-w-0 content-start gap-2 p-3">
                <div className="aspect-video min-w-0 overflow-hidden rounded-lg border border-line bg-paper">
                  {item.contentType.startsWith("video/") ? (
                    <video className="block size-full max-h-full max-w-full bg-black object-contain" controls preload="metadata" src={item.url} title={item.filename} />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt={item.filename} className="block size-full max-h-full max-w-full object-contain" src={item.url} />
                  )}
                </div>
                <h2 className="truncate text-sm font-black">{item.filename}</h2>
                <p className="text-xs text-stone-600">{Math.ceil(item.size / 1024)} KB</p>
                <div className="flex min-w-0 items-center rounded-lg bg-stone-100">
                  <code className="min-w-0 flex-1 truncate bg-transparent p-2 text-xs">{item.markdown}</code>
                  <Tooltip>
                  <Button
                    isIconOnly
                    aria-label={`${t.copyMarkdown}: ${item.filename}`}
                    className="mr-1"
                    size="sm"
                    variant="ghost"
                    onPress={() => copyMediaMarkdown(item)}
                  >
                    {copiedMediaId === item.id ? (
                      <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    ) : (
                      <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                        <rect height="14" rx="2" width="14" x="8" y="8" />
                        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                      </svg>
                    )}
                  </Button>
                  <Tooltip.Content>{t.copyMarkdown}</Tooltip.Content>
                  </Tooltip>
                </div>
                <Button
                  className="w-full sm:w-fit"
                  isDisabled={busy}
                  size="sm"
                  variant="outline"
                  onPress={() => deleteMedia(item.id)}
                >
                  {t.delete}
                </Button>
                </Card.Content>
              </Card>
            ))}
          </div>
        ) : null}
        {!listLoading && activeTab === "media" && !media.length ? (
          <Card className="border border-dashed border-line bg-white/80">
            <Card.Content className="items-center p-6 text-center sm:p-10">
            <p className="mb-4 font-semibold text-stone-700">{t.noMedia}</p>
            <label className="inline-flex cursor-pointer rounded-md bg-mint px-4 py-2 text-sm font-semibold text-white shadow-sm">
              {t.uploadMedia}
              <input
                accept="image/*,video/*"
                className="sr-only"
                disabled={busy}
                onChange={(event) => uploadMedia(event.target.files?.[0] ?? null)}
                type="file"
              />
            </label>
            </Card.Content>
          </Card>
        ) : null}
        {!listLoading && activeTab === "shared" && sharedSlides.length ? (
          <div className="grid gap-3">
            {sharedSlides.map((slide) => (
              <Card className="border border-line bg-white/90 shadow-panel" key={slide.id}>
                <Card.Content>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-black sm:text-xl">{slide.title}</h2>
                    <p className="mt-1 text-sm text-stone-600">
                      {t.updated}: {new Date(slide.updatedAt).toLocaleString(language === "ja" ? "ja-JP" : "en-US")}
                    </p>
                    <p className="mt-2 truncate text-sm text-stone-600">{slide.markdown.split("\n").slice(0, 2).join(" ")}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                    <Button
                      className="w-full sm:w-auto"
                      isDisabled={busy}
                      size="sm"
                      variant="outline"
                      onPress={() => deleteSharedSlide(slide.id)}
                    >
                      {t.delete}
                    </Button>
                    <Link href={`/shared-slides/${slide.id}/edit`}>
                      <Button className="w-full sm:w-auto" size="sm" variant="primary">{t.edit}</Button>
                    </Link>
                  </div>
                </div>
                </Card.Content>
              </Card>
            ))}
          </div>
        ) : null}
        {!listLoading && activeTab === "shared" && !sharedSlides.length ? (
          <Card className="border border-dashed border-line bg-white/80">
            <Card.Content className="items-center p-6 text-center sm:p-10">
            <p className="mb-4 font-semibold text-stone-700">{t.noSharedSlides}</p>
            <Link href="/shared-slides/new">
              <Button variant="primary">{t.createSharedSlide}</Button>
            </Link>
            </Card.Content>
          </Card>
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

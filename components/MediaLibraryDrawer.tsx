"use client";

import { LoadingBlock } from "@/components/LoadingBlock";
import { useLanguage } from "@/lib/i18n";

export type MediaLibraryItem = {
  contentType: string;
  id: string;
  filename: string;
  markdown: string;
  size: number;
  updatedAt: string;
  url: string;
};

type MediaLibraryDrawerProps = {
  error: string | null;
  isLoading: boolean;
  isUploading: boolean;
  media: MediaLibraryItem[];
  onClose: () => void;
  onCopyMedia: (item: MediaLibraryItem) => void;
  onInsertMedia: (item: MediaLibraryItem) => void;
  onUpload: (file: File | null) => void;
};

export function MediaLibraryDrawer({
  error,
  isLoading,
  isUploading,
  media,
  onClose,
  onCopyMedia,
  onInsertMedia,
  onUpload,
}: MediaLibraryDrawerProps) {
  const { t } = useLanguage();

  return (
    <div className="fixed inset-0 z-40">
      <button
        aria-label={t.closeMediaLibrary}
        className="absolute inset-0 bg-black/20"
        onClick={onClose}
        type="button"
      />
      <aside className="absolute right-0 top-0 grid h-full w-full max-w-md content-start gap-4 overflow-y-auto border-l border-line bg-paper p-5 shadow-panel">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black">{t.mediaTab}</h2>
          <button className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold" onClick={onClose} type="button">
            {t.close}
          </button>
        </div>
        <label className="inline-flex cursor-pointer justify-center rounded-md bg-mint px-4 py-3 text-sm font-semibold text-white has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
          {t.uploadMedia}
          <input
            accept="image/*,video/*"
            className="sr-only"
            disabled={isUploading}
            onChange={(event) => {
              onUpload(event.target.files?.[0] ?? null);
              event.currentTarget.value = "";
            }}
            type="file"
          />
        </label>
        {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        <div className="grid gap-2">
          {isLoading ? <LoadingBlock label={t.mediaLoading} /> : null}
          {!isLoading && media.length ? (
            media.map((item) => (
              <article className="rounded-md border border-line bg-white p-3" key={item.id}>
                <div className="aspect-video overflow-hidden rounded-md border border-line bg-paper">
                  {item.contentType.startsWith("video/") ? (
                    <video className="h-full w-full bg-black object-contain" controls preload="metadata" src={item.url} title={item.filename} />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt={item.filename} className="h-full w-full object-contain" src={item.url} />
                  )}
                </div>
                <h3 className="mt-3 truncate text-sm font-black">{item.filename}</h3>
                <button
                  className="mt-3 h-9 w-full rounded-md bg-mint px-3 text-sm font-semibold text-white"
                  onClick={() => onInsertMedia(item)}
                  type="button"
                >
                  {t.addToCurrentPage}
                </button>
                <button
                  className="mt-2 h-9 w-full rounded-md border border-line bg-white px-3 text-sm font-semibold"
                  onClick={() => onCopyMedia(item)}
                  type="button"
                >
                  {t.copyMarkdown}
                </button>
              </article>
            ))
          ) : !isLoading ? (
            <div className="rounded-md border border-dashed border-line bg-white p-4">
              <p className="text-sm text-stone-600">{t.noMedia}</p>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

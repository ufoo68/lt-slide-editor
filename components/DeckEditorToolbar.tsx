"use client";

import Link from "next/link";
import { Button, Switch } from "ufoo-ui";
import { useLanguage } from "@/lib/i18n";

type DeckEditorToolbarProps = {
  busy: boolean;
  hasUnsavedChanges: boolean;
  presentationMinutes: number;
  publicSlug: string | null;
  title: string;
  visibility: "private" | "public";
  onLibraryOpen: () => void;
  onMediaOpen: () => void;
  onPresentationMinutesChange: (minutes: number) => void;
  onSave: () => void;
  onTitleChange: (title: string) => void;
  onVisibilityChange: (visibility: "private" | "public") => void;
};

export function DeckEditorToolbar({
  busy,
  hasUnsavedChanges,
  presentationMinutes,
  publicSlug,
  title,
  visibility,
  onLibraryOpen,
  onMediaOpen,
  onPresentationMinutesChange,
  onSave,
  onTitleChange,
  onVisibilityChange,
}: DeckEditorToolbarProps) {
  const { t } = useLanguage();

  return (
    <div className="grid gap-3 lg:flex lg:flex-wrap lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-2 lg:block">
        <Link
          aria-label={t.dashboard}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-line bg-white text-foreground lg:hidden"
          href="/dashboard"
        >
          <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <Link className="hidden text-sm font-semibold text-primary lg:inline" href="/dashboard">
          {t.dashboard}
        </Link>
        <input
          className="block min-w-0 flex-1 bg-transparent text-base font-black outline-none sm:text-xl lg:mt-1 lg:w-full lg:min-w-72 lg:text-2xl"
          onChange={(event) => onTitleChange(event.target.value)}
          value={title}
        />
      </div>
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 lg:hidden">
        {publicSlug ? (
          <Link className="shrink-0 lg:col-span-2 xl:col-span-1" href={`/view/${publicSlug}`} target="_blank">
            <Button aria-label={t.openPublicUrl} className="h-9 w-9 min-w-9 px-0 xl:h-10 xl:w-auto xl:px-3" size="sm" variant="outline">
              <svg aria-hidden="true" className="h-4 w-4 xl:mr-1" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M15 3h6v6" />
                <path d="M10 14 21 3" />
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              </svg>
              <span className="hidden xl:inline">{t.openPublicUrl}</span>
            </Button>
          </Link>
        ) : null}
        <label className="flex h-9 shrink-0 items-center gap-1 rounded-md border border-line bg-white px-1.5 text-sm font-semibold xl:h-10 lg:col-span-2 xl:col-span-1">
          <span className="sr-only">{t.presentationTime}</span>
          <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          <input
            aria-label={t.presentationTime}
            className="h-8 w-8 bg-transparent text-right outline-none sm:w-12"
            max={180}
            min={1}
            onChange={(event) => onPresentationMinutesChange(Math.max(1, Math.min(180, Number(event.target.value) || 1)))}
            type="number"
            value={presentationMinutes}
          />
          <span className="text-xs">{t.minutesUnit}</span>
        </label>
        <Switch
          className="flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-line bg-white px-2 text-sm font-semibold xl:h-10 xl:px-3 xl:justify-start"
          isSelected={visibility === "public"}
          size="sm"
          onChange={(selected) => onVisibilityChange(selected ? "public" : "private")}
        >
          <Switch.Control
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              visibility === "public" ? "bg-mint" : "bg-stone-300"
            }`}
          >
            <span
              className={`absolute top-0.5 block h-4 w-4 rounded-full bg-white shadow transition-[left] ${
                visibility === "public" ? "left-4.5" : "left-0.5"
              }`}
            />
          </Switch.Control>
          {t.public}
        </Switch>
        <Button aria-label={t.mediaTab} className="h-9 w-9 min-w-9 shrink-0 px-0 xl:h-10 xl:w-auto xl:px-3" variant="outline" onPress={onMediaOpen}>
          <svg aria-hidden="true" className="h-4 w-4 xl:mr-1" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
            <rect height="18" rx="2" width="18" x="3" y="3" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
          </svg>
          <span className="hidden xl:inline">{t.mediaTab}</span>
        </Button>
        <Button aria-label={t.sharedSlidesTab} className="h-9 w-9 min-w-9 shrink-0 px-0 xl:h-10 xl:w-auto xl:px-3" variant="outline" onPress={onLibraryOpen}>
          <svg aria-hidden="true" className="h-4 w-4 xl:mr-1" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
            <rect height="14" rx="2" width="18" x="3" y="5" />
            <path d="M7 9h10" />
            <path d="M7 13h6" />
          </svg>
          <span className="hidden xl:inline">{t.sharedSlidesTab}</span>
        </Button>
        <Button
          aria-label={t.save}
          className="h-9 w-9 min-w-9 shrink-0 px-0 xl:h-10 xl:w-auto xl:px-3"
          isDisabled={busy || !title.trim() || !hasUnsavedChanges}
          variant="primary"
          onPress={onSave}
        >
          <svg aria-hidden="true" className="h-4 w-4 xl:mr-1" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
            <path d="M17 21v-8H7v8" />
            <path d="M7 3v5h8" />
          </svg>
          <span className="hidden xl:inline">{t.save}</span>
        </Button>
      </div>
    </div>
  );
}

"use client";

import { Button } from "ufoo-ui";
import { useLanguage } from "@/lib/i18n";

export type SlideAgentResult = {
  markdown: string;
  notes: string;
};

export type SlideAgentMessage = {
  content: string;
  role: "assistant" | "user";
};

type SlideAgentPanelProps = {
  canUndo: boolean;
  canManageDeckAgentToken: boolean;
  deckAgentToken: string | null;
  deckAgentTokenCreatedAt: string | null;
  error: string | null;
  embedded?: boolean;
  isLoading: boolean;
  isManagingDeckAgentToken: boolean;
  messages: SlideAgentMessage[];
  externalSkill: string;
  prompt: string;
  onClose?: () => void;
  onCreateDeckAgentToken: () => void;
  onExternalSkillChange: (externalSkill: string) => void;
  onPromptChange: (prompt: string) => void;
  onRevokeDeckAgentToken: () => void;
  onRun: () => void;
  onUndo: () => void;
};

export function SlideAgentPanel({
  canUndo,
  canManageDeckAgentToken,
  deckAgentToken,
  deckAgentTokenCreatedAt,
  error,
  embedded = false,
  isLoading,
  isManagingDeckAgentToken,
  messages,
  externalSkill,
  prompt,
  onClose,
  onCreateDeckAgentToken,
  onExternalSkillChange,
  onPromptChange,
  onRevokeDeckAgentToken,
  onRun,
  onUndo,
}: SlideAgentPanelProps) {
  const { t } = useLanguage();
  const containerClassName = embedded
    ? "grid h-full min-h-0 min-w-0 w-full max-w-full grid-rows-[auto_minmax(0,1fr)_auto] gap-3 overflow-hidden rounded-md border border-ufoo-panel-border bg-[#15171d] p-3 text-white"
    : "fixed bottom-4 right-4 z-40 grid max-h-[min(42rem,calc(100dvh-2rem))] w-[calc(100vw-2rem)] max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] gap-3 rounded-lg border border-sky-200 bg-white p-4 shadow-2xl";
  const headingClassName = embedded
    ? "text-sm font-black uppercase tracking-normal text-ufoo-ink"
    : "text-sm font-black uppercase tracking-normal text-stone-700";
  const descriptionClassName = embedded
    ? "mt-1 text-xs font-medium text-ufoo-muted"
    : "mt-1 text-xs font-medium text-stone-600";

  return (
    <aside className={containerClassName}>
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className={headingClassName}>{t.aiAgent}</h2>
          <p className={descriptionClassName}>{t.aiAgentDescription}</p>
        </div>
        {onClose ? (
          <Button aria-label={t.close} className="h-8 w-8 min-w-8 px-0" size="sm" variant="outline" onPress={onClose}>
            <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </Button>
        ) : null}
      </div>

      <div className="min-h-0 min-w-0 overflow-y-auto rounded-md border border-line bg-[#0c0f15] p-3">
        <div className="grid min-w-0 gap-3">
          {messages.length === 0 && !error && !isLoading ? (
            <div className="max-w-[92%] justify-self-start rounded-lg rounded-tl-sm border border-ufoo-panel-border bg-[#15171d] p-3 text-sm font-medium leading-6 text-ufoo-ink">
              {t.aiAgentEmpty}
            </div>
          ) : null}

          {messages.map((message, index) => (
            <div
              className={
                message.role === "user"
                  ? "max-w-[92%] justify-self-end whitespace-pre-wrap rounded-lg rounded-tr-sm bg-ufoo-neon px-3 py-2 text-sm font-semibold leading-6 text-[#061014]"
                  : "max-w-[92%] justify-self-start whitespace-pre-wrap rounded-lg rounded-tl-sm border border-ufoo-panel-border bg-[#15171d] p-3 text-sm font-medium leading-6 text-ufoo-ink"
              }
              key={`${message.role}-${index}`}
            >
              {message.content}
            </div>
          ))}

          {isLoading ? (
            <div className="flex max-w-[92%] items-center gap-2 justify-self-start rounded-lg rounded-tl-sm border border-ufoo-panel-border bg-[#15171d] px-3 py-2 text-sm font-semibold text-ufoo-ink">
              <span>{t.aiAgentGenerating}</span>
              <span className="flex gap-1" aria-hidden="true">
                <span className="h-1.5 w-1.5 rounded-full bg-ufoo-neon" />
                <span className="h-1.5 w-1.5 rounded-full bg-ufoo-neon/70" />
                <span className="h-1.5 w-1.5 rounded-full bg-ufoo-neon/40" />
              </span>
            </div>
          ) : null}

          {error && messages.at(-1)?.content !== error ? (
            <div className="max-w-[92%] justify-self-start whitespace-pre-wrap rounded-lg rounded-tl-sm border border-red-300 bg-red-950/40 p-3 text-sm font-semibold leading-6 text-red-100">
              {error}
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid min-w-0 gap-2">
        <div className="grid min-w-0 gap-2 rounded-lg border border-ufoo-panel-border bg-[#0c0f15] p-2">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-normal text-ufoo-muted">{t.deckAgentToken}</p>
            <p className="truncate text-xs font-medium text-ufoo-muted">
              {deckAgentTokenCreatedAt ? t.deckAgentTokenActive : t.deckAgentTokenInactive}
            </p>
          </div>
          <div className="grid min-w-0 grid-cols-2 gap-2">
              <Button
                className="h-8 min-w-0 w-full px-2 text-xs"
                isDisabled={!canManageDeckAgentToken || isLoading || isManagingDeckAgentToken}
                size="sm"
                variant="outline"
                onPress={onCreateDeckAgentToken}
              >
                {t.issueDeckAgentToken}
              </Button>
              <Button
                className="h-8 min-w-0 w-full px-2 text-xs"
                isDisabled={!canManageDeckAgentToken || !deckAgentTokenCreatedAt || isLoading || isManagingDeckAgentToken}
                size="sm"
                variant="outline"
                onPress={onRevokeDeckAgentToken}
              >
                {t.revokeDeckAgentToken}
              </Button>
          </div>
          {deckAgentToken ? (
            <textarea
              aria-label={t.deckAgentToken}
              className="h-16 resize-none rounded-md border border-ufoo-panel-border bg-[#15171d] p-2 font-mono text-xs leading-5 text-ufoo-ink outline-none"
              readOnly
              value={deckAgentToken}
            />
          ) : null}
        </div>
        <label className="grid gap-1">
          <span className="text-xs font-black uppercase tracking-normal text-ufoo-muted">{t.aiAgentSkill}</span>
          <textarea
            aria-label={t.aiAgentSkill}
            className="h-20 resize-none rounded-lg border border-ufoo-panel-border bg-[#0c0f15] p-2 font-mono text-xs leading-5 text-ufoo-ink outline-none placeholder:text-ufoo-muted focus:border-ufoo-neon focus:ring-1 focus:ring-ufoo-neon"
            maxLength={20000}
            onChange={(event) => onExternalSkillChange(event.target.value)}
            placeholder={t.aiAgentSkillPlaceholder}
            spellCheck={false}
            value={externalSkill}
          />
        </label>
        <div className="flex items-center gap-2 rounded-lg border border-ufoo-panel-border bg-[#0c0f15] p-2">
          <textarea
            aria-label={t.aiAgentPrompt}
            className="h-7 min-w-0 flex-1 resize-none border-0 bg-transparent p-1 text-sm font-medium leading-5 text-ufoo-ink outline-none placeholder:text-ufoo-muted"
            maxLength={8000}
            onChange={(event) => onPromptChange(event.target.value)}
            placeholder={t.aiAgentPromptPlaceholder}
            value={prompt}
          />
          <Button aria-label={t.undoGeneratedMarkdown} className="h-9 w-9 min-w-9 px-0" isDisabled={isLoading || !canUndo} size="sm" variant="outline" onPress={onUndo}>
            <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M3 7v6h6" />
              <path d="M21 17a9 9 0 0 0-15-6.7L3 13" />
            </svg>
          </Button>
          <Button aria-label={t.runAiAgent} className="h-9 w-9 min-w-9 px-0" isDisabled={isLoading || !prompt.trim()} size="sm" variant="primary" onPress={onRun}>
            <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
          </Button>
        </div>
      </div>
    </aside>
  );
}

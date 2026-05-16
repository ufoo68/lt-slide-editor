"use client";

import { Button } from "ufoo-ui";
import { useLanguage } from "@/lib/i18n";

export type SlideAgentResult = {
  markdown: string;
  notes: string;
};

type SlideAgentPanelProps = {
  error: string | null;
  isLoading: boolean;
  prompt: string;
  result: SlideAgentResult | null;
  onApply: () => void;
  onClose: () => void;
  onPromptChange: (prompt: string) => void;
  onRun: () => void;
};

export function SlideAgentPanel({
  error,
  isLoading,
  prompt,
  result,
  onApply,
  onClose,
  onPromptChange,
  onRun,
}: SlideAgentPanelProps) {
  const { t } = useLanguage();

  return (
    <aside className="fixed bottom-4 right-4 z-40 grid max-h-[min(42rem,calc(100dvh-2rem))] w-[calc(100vw-2rem)] max-w-2xl grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-3 rounded-lg border border-sky-200 bg-white p-4 shadow-2xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-black uppercase tracking-normal text-stone-700">{t.aiAgent}</h2>
          <p className="mt-1 text-xs font-medium text-stone-600">{t.aiAgentDescription}</p>
        </div>
        <Button aria-label={t.close} className="h-8 w-8 min-w-8 px-0" size="sm" variant="outline" onPress={onClose}>
          <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </Button>
      </div>

      <label className="grid gap-1 text-xs font-bold text-stone-900">
        <span>{t.aiAgentPrompt}</span>
        <textarea
          className="min-h-28 resize-y rounded-md border border-stone-400 bg-stone-50 p-3 text-sm font-medium leading-6 text-stone-900 outline-mint placeholder:text-stone-500"
          maxLength={8000}
          onChange={(event) => onPromptChange(event.target.value)}
          placeholder={t.aiAgentPromptPlaceholder}
          value={prompt}
        />
      </label>

      <div className="min-h-0 overflow-y-auto rounded-md border border-line bg-stone-50">
        {isLoading ? (
          <p className="p-3 text-sm font-semibold text-sky-950">{t.aiAgentGenerating}</p>
        ) : error ? (
          <p className="m-3 rounded-md bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p>
        ) : result ? (
          <div className="grid gap-3 p-3">
            {result.notes ? (
              <p className="whitespace-pre-wrap rounded-md bg-sky-50 p-3 text-sm font-semibold leading-6 text-sky-950">{result.notes}</p>
            ) : null}
            <pre className="max-h-[24rem] overflow-auto rounded-md bg-[#111827] p-3 text-xs leading-5 text-slate-100">
              {result.markdown}
            </pre>
          </div>
        ) : (
          <p className="p-3 text-sm font-medium leading-6 text-stone-700">{t.aiAgentEmpty}</p>
        )}
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button isDisabled={isLoading || !prompt.trim()} size="sm" variant="primary" onPress={onRun}>
          {isLoading ? t.aiAgentGenerating : t.runAiAgent}
        </Button>
        <Button isDisabled={isLoading || !result?.markdown.trim()} size="sm" variant="outline" onPress={onApply}>
          {t.applyGeneratedMarkdown}
        </Button>
      </div>
    </aside>
  );
}

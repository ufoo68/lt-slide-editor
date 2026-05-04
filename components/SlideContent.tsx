"use client";

import { useEffect, useRef } from "react";

type SlideContentProps = {
  className?: string;
  html: string;
};

export function SlideContent({ className, html }: SlideContentProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function renderMermaid() {
      const mermaidNodes = ref.current?.querySelectorAll<HTMLElement>("pre.mermaid");
      if (!mermaidNodes?.length) {
        return;
      }

      const mermaid = (await import("mermaid")).default;
      if (cancelled) {
        return;
      }

      mermaid.initialize({
        securityLevel: "strict",
        startOnLoad: false,
        theme: "default",
      });
      await mermaid.run({ nodes: Array.from(mermaidNodes) });
    }

    renderMermaid().catch((error: unknown) => {
      console.error(error);
    });

    return () => {
      cancelled = true;
    };
  }, [html]);

  return <article className={className} dangerouslySetInnerHTML={{ __html: html }} ref={ref} />;
}

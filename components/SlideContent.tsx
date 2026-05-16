"use client";

import { useEffect, useRef } from "react";

type SlideContentProps = {
  className?: string;
  html: string;
};

let mermaidInitialized = false;
let mermaidRenderCounter = 0;

export function SlideContent({ className, html }: SlideContentProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function renderMermaid() {
      const mermaidNodes = Array.from(ref.current?.querySelectorAll<HTMLElement>("pre.mermaid") ?? []);
      if (!mermaidNodes.length) {
        return;
      }

      const mermaid = (await import("mermaid")).default;
      if (cancelled) {
        return;
      }

      if (!mermaidInitialized) {
        mermaid.initialize({
          securityLevel: "strict",
          startOnLoad: false,
          theme: "default",
        });
        mermaid.setParseErrorHandler(() => {});
        mermaidInitialized = true;
      }

      for (const node of mermaidNodes) {
        if (cancelled || !ref.current?.contains(node)) {
          return;
        }

        const definition = node.textContent ?? "";
        const parseResult = await mermaid.parse(definition, { suppressErrors: true });
        if (cancelled || !ref.current?.contains(node)) {
          return;
        }

        if (!parseResult) {
          node.classList.add("mermaid-error");
          continue;
        }

        try {
          const renderId = `lt-slide-mermaid-${Date.now()}-${mermaidRenderCounter++}`;
          const { svg, bindFunctions } = await mermaid.render(renderId, definition);
          if (cancelled || !ref.current?.contains(node)) {
            return;
          }

          node.innerHTML = svg;
          node.dataset.processed = "true";
          bindFunctions?.(node);
        } catch {
          if (!cancelled && ref.current?.contains(node)) {
            node.classList.add("mermaid-error");
          }
        }
      }
    }

    renderMermaid().catch((error: unknown) => {
      if (process.env.NODE_ENV === "development") {
        console.warn("Mermaid rendering skipped", error);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [html]);

  return <article className={className} dangerouslySetInnerHTML={{ __html: html }} ref={ref} />;
}

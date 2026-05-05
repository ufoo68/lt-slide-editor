import hljs from "highlight.js/lib/common";
import MarkdownIt from "markdown-it";
import sanitizeHtml from "sanitize-html";

export type Slide = {
  index: number;
  markdown: string;
  html: string;
  stats: SlideStats;
};

export type SlideStats = {
  charCount: number;
  bulletCount: number;
  maxCodeLines: number;
};

export type SlideWarning = {
  slideIndex?: number;
  message: string;
  severity: "info" | "warning";
};

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  highlight(code, lang) {
    if (lang === "mermaid") {
      return `<pre class="mermaid">${escapeHtml(code)}</pre>`;
    }

    const language = lang && hljs.getLanguage(lang) ? lang : "plaintext";
    const highlighted = hljs.highlight(code, { language }).value;
    return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
  },
});

function parseImageLayout(title: string | null) {
  const match = title?.match(/\blt-image:([^\s"]+)/);
  if (!match) {
    return null;
  }

  const layout = Object.fromEntries(
    match[1]
      .split(";")
      .map((part) => part.split("="))
      .filter(([key, value]) => key && value)
  );
  const x = Number(layout.x);
  const y = Number(layout.y);
  const w = Number(layout.w);
  const h = Number(layout.h);

  if (![x, y, w, h].every(Number.isFinite)) {
    return null;
  }

  return {
    h: Math.min(Math.max(h, 5), 100),
    w: Math.min(Math.max(w, 5), 100),
    x: Math.min(Math.max(x, 0), 95),
    y: Math.min(Math.max(y, 0), 95),
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

md.renderer.rules.image = (tokens, idx, options, env) => {
  const token = tokens[idx];
  const src = token.attrGet("src") ?? "";
  const alt = token.content || token.attrGet("alt") || "";
  const title = token.attrGet("title");
  const layout = parseImageLayout(title);
  const imageIndex = typeof env.imageIndex === "number" ? env.imageIndex : 0;
  env.imageIndex = imageIndex + 1;

  const resolvedLayout = layout ?? { h: 34, w: 42, x: 29, y: 33 };

  const style = `left:${resolvedLayout.x}%;top:${resolvedLayout.y}%;width:${resolvedLayout.w}%;height:${resolvedLayout.h}%;`;
  const titleAttr = title && !layout ? ` title="${escapeHtml(title)}"` : "";
  return [
    `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"${titleAttr}`,
    ` class="slide-image-absolute"`,
    ` data-slide-image-index="${imageIndex}"`,
    ` data-image-layout="x=${resolvedLayout.x};y=${resolvedLayout.y};w=${resolvedLayout.w};h=${resolvedLayout.h}"`,
    ` style="${style}">`,
  ].join("");
};

const sanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2", "pre", "code", "span"]),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    a: ["href", "name", "target", "rel"],
    img: ["src", "alt", "title", "class", "data-slide-image-index", "data-image-layout", "style"],
    code: ["class"],
    span: ["class"],
    pre: ["class"],
  },
  allowedStyles: {
    img: {
      height: [/^\d+(?:\.\d+)?%$/],
      left: [/^\d+(?:\.\d+)?%$/],
      top: [/^\d+(?:\.\d+)?%$/],
      width: [/^\d+(?:\.\d+)?%$/],
    },
  },
  allowedSchemes: ["http", "https", "mailto", "data"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
  },
};

export function splitSlides(markdown: string) {
  return markdown
    .split(/\n---\s*(?:\n|$)/g)
    .map((slide) => slide.trim())
    .filter(Boolean);
}

export function splitEditableSlides(markdown: string) {
  const slides = markdown.split(/\n---\s*(?:\n|$)/g);
  return slides.length ? slides : [""];
}

export function joinEditableSlides(slides: string[]) {
  return slides.join("\n---\n");
}

export function renderMarkdown(markdown: string) {
  return sanitizeHtml(md.render(markdown, { imageIndex: 0 }), sanitizeOptions);
}

export function slideStats(markdown: string): SlideStats {
  const bulletCount = markdown.split("\n").filter((line) => /^\s*[-*+]\s+/.test(line)).length;
  const codeBlocks = [...markdown.matchAll(/```[\w-]*\n([\s\S]*?)```/g)];
  const maxCodeLines = codeBlocks.reduce((max, block) => {
    const lineCount = block[1].trimEnd().split("\n").filter(Boolean).length;
    return Math.max(max, lineCount);
  }, 0);

  return {
    charCount: markdown.replace(/\s/g, "").length,
    bulletCount,
    maxCodeLines,
  };
}

export function renderSlides(markdown: string): Slide[] {
  return splitEditableSlides(markdown).map((slide, index) => ({
    index,
    markdown: slide,
    html: renderMarkdown(slide),
    stats: slideStats(slide),
  }));
}

export function analyzeDeck(markdown: string): SlideWarning[] {
  const slides = splitSlides(markdown);
  const warnings: SlideWarning[] = [];

  if (slides.length > 18) {
    warnings.push({
      message: "10分LTにはスライド枚数が多めです。18枚以下を目安にすると話しやすくなります。",
      severity: "warning",
    });
  }

  slides.forEach((slide, index) => {
    const stats = slideStats(slide);
    if (stats.charCount > 240) {
      warnings.push({
        slideIndex: index + 1,
        message: "1スライドの文字数が多めです。話す内容を口頭に寄せると見やすくなります。",
        severity: "warning",
      });
    }
    if (stats.bulletCount > 7) {
      warnings.push({
        slideIndex: index + 1,
        message: "箇条書きが多めです。5個前後まで減らすと視線が迷いにくくなります。",
        severity: "warning",
      });
    }
    if (stats.maxCodeLines > 14) {
      warnings.push({
        slideIndex: index + 1,
        message: "コードブロックが長めです。LTでは重要部分だけに絞るのがおすすめです。",
        severity: "warning",
      });
    }
  });

  return warnings;
}

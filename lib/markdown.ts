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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const sanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2", "pre", "code", "span"]),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    a: ["href", "name", "target", "rel"],
    img: ["src", "alt", "title"],
    code: ["class"],
    span: ["class"],
    pre: ["class"],
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
  const slides = markdown.split(/\n---\s*(?:\n|$)/g).map((slide) => slide.trim());
  return slides.length ? slides : [""];
}

export function joinEditableSlides(slides: string[]) {
  return slides.map((slide) => slide.trim()).join("\n\n---\n\n");
}

export function renderMarkdown(markdown: string) {
  return sanitizeHtml(md.render(markdown), sanitizeOptions);
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

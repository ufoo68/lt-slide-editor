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

const md = new MarkdownIt({
  html: true,
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

  return normalizeImageLayout({ h, w, x, y });
}

function normalizeImageLayout(layout: { h: number; w: number; x: number; y: number }) {
  return {
    h: Math.min(Math.max(layout.h, 5), 100),
    w: Math.min(Math.max(layout.w, 5), 100),
    x: Math.min(Math.max(layout.x, 0), 95),
    y: Math.min(Math.max(layout.y, 0), 95),
  };
}

function parseImageStyle(style: string | undefined) {
  const layout = Object.fromEntries(
    (style ?? "")
      .split(";")
      .map((part) => part.split(":").map((value) => value.trim()))
      .filter(([key, value]) => key && value)
  );
  const x = Number(layout.left?.replace(/%$/, ""));
  const y = Number(layout.top?.replace(/%$/, ""));
  const w = Number(layout.width?.replace(/%$/, ""));
  const h = Number(layout.height?.replace(/%$/, ""));

  if (![x, y, w, h].every(Number.isFinite)) {
    return null;
  }

  return normalizeImageLayout({ h, w, x, y });
}

function imageStyle(layout: { h: number; w: number; x: number; y: number }) {
  return `position:absolute;left:${layout.x}%;top:${layout.y}%;width:${layout.w}%;height:${layout.h}%;object-fit:contain;`;
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

  const titleAttr = title && !layout ? ` title="${escapeHtml(title)}"` : "";
  return [
    `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"${titleAttr}`,
    ` class="slide-image-absolute"`,
    ` data-slide-image-index="${imageIndex}"`,
    ` data-image-layout="x=${resolvedLayout.x};y=${resolvedLayout.y};w=${resolvedLayout.w};h=${resolvedLayout.h}"`,
    ` style="${imageStyle(resolvedLayout)}">`,
  ].join("");
};

function sanitizeOptions(): sanitizeHtml.IOptions {
  let imageIndex = 0;

  return {
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
        "object-fit": [/^contain$/],
        position: [/^absolute$/],
        top: [/^\d+(?:\.\d+)?%$/],
        width: [/^\d+(?:\.\d+)?%$/],
      },
    },
    allowedSchemes: ["http", "https", "mailto", "data"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
      img: (tagName, attribs) => {
        const layout = parseImageStyle(attribs.style) ?? parseImageLayout(attribs.title ?? null) ?? { h: 34, w: 42, x: 29, y: 33 };
        const nextImageIndex = imageIndex;
        imageIndex += 1;

        return {
          tagName,
          attribs: {
            ...attribs,
            class: [attribs.class, "slide-image-absolute"].filter(Boolean).join(" "),
            "data-slide-image-index": String(nextImageIndex),
            "data-image-layout": `x=${layout.x};y=${layout.y};w=${layout.w};h=${layout.h}`,
            style: imageStyle(layout),
          },
        };
      },
    },
  };
}

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
  return sanitizeHtml(md.render(markdown, { imageIndex: 0 }), sanitizeOptions());
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

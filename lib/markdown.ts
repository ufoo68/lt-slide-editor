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

export const slideThemes = ["light", "dark", "mint"] as const;

export type SlideTheme = (typeof slideThemes)[number];

export type SlideDeckSettings = {
  footer: string;
  header: string;
  theme: SlideTheme;
};

export type ParsedDeckMarkdown = {
  body: string;
  frontMatter: string | null;
  settings: SlideDeckSettings;
};

export const defaultSlideDeckSettings: SlideDeckSettings = {
  footer: "",
  header: "",
  theme: "light",
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

const slideSeparatorPattern = /\r?\n---[ \t]*(?:\r?\n|$)/g;

function parseSlideTheme(value: string): SlideTheme {
  const normalized = value.trim().toLowerCase();
  if (normalized === "dark" || normalized === "light" || normalized === "mint") {
    return normalized;
  }
  return "light";
}

function unquoteFrontMatterValue(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseDeckMarkdown(markdown: string): ParsedDeckMarkdown {
  const match = markdown.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    return {
      body: markdown,
      frontMatter: null,
      settings: defaultSlideDeckSettings,
    };
  }

  const settings = { ...defaultSlideDeckSettings };
  const frontMatterBody = match[1];
  for (const line of frontMatterBody.split(/\r?\n/)) {
    const lineMatch = line.match(/^\s*([A-Za-z][\w-]*)\s*:\s*(.*?)\s*$/);
    if (!lineMatch) {
      continue;
    }

    const key = lineMatch[1].toLowerCase();
    const value = unquoteFrontMatterValue(lineMatch[2]);
    if (key === "theme") {
      settings.theme = parseSlideTheme(value);
    }
    if (key === "header") {
      settings.header = value;
    }
    if (key === "footer" || key === "hooter") {
      settings.footer = value;
    }
  }

  return {
    body: markdown.slice(match[0].length),
    frontMatter: match[0].trimEnd(),
    settings,
  };
}

function quoteFrontMatterValue(value: string) {
  return JSON.stringify(value);
}

export function buildDeckFrontMatter(settings: SlideDeckSettings) {
  return [
    "---",
    `theme: ${settings.theme}`,
    `header: ${quoteFrontMatterValue(settings.header)}`,
    `footer: ${quoteFrontMatterValue(settings.footer)}`,
    "---",
  ].join("\n");
}

export function updateDeckSettings(markdown: string, settings: SlideDeckSettings) {
  const parsed = parseDeckMarkdown(markdown);
  return `${buildDeckFrontMatter(settings)}\n${parsed.body.replace(/^\s+/, "")}`;
}

export function slideThemeClasses(theme: SlideTheme) {
  switch (theme) {
    case "dark":
      return {
        chrome: "bg-ufoo-workspace text-ufoo-ink",
        meta: "text-ufoo-muted",
        slide: "slide-theme-dark bg-ufoo-dark text-ufoo-ink",
      };
    case "light":
      return {
        chrome: "bg-slate-100 text-slate-900",
        meta: "text-slate-500",
        slide: "bg-[#ffffff] text-slate-950",
      };
    case "mint":
      return {
        chrome: "bg-emerald-100 text-emerald-950",
        meta: "text-emerald-700",
        slide: "bg-[#ecfdf5] text-emerald-950",
      };
    default:
      return {
        chrome: "bg-slate-100 text-slate-900",
        meta: "text-slate-500",
        slide: "bg-[#ffffff] text-slate-950",
      };
  }
}

function parseMediaLayout(title: string | null) {
  const match = title?.match(/\blt-media:([^\s"]+)/);
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

  return normalizeMediaLayout({ h, w, x, y });
}

function normalizeMediaLayout(layout: { h: number; w: number; x: number; y: number }) {
  return {
    h: Math.min(Math.max(layout.h, 5), 100),
    w: Math.min(Math.max(layout.w, 5), 100),
    x: Math.min(Math.max(layout.x, 0), 95),
    y: Math.min(Math.max(layout.y, 0), 95),
  };
}

function parseMediaStyle(style: string | undefined) {
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

  return normalizeMediaLayout({ h, w, x, y });
}

function mediaStyle(layout: { h: number; w: number; x: number; y: number }) {
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
  const layout = parseMediaLayout(title);
  const mediaIndex = typeof env.mediaIndex === "number" ? env.mediaIndex : 0;
  env.mediaIndex = mediaIndex + 1;

  const resolvedLayout = layout ?? { h: 34, w: 42, x: 29, y: 33 };

  const titleAttr = title && !layout ? ` title="${escapeHtml(title)}"` : "";
  return [
    `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"${titleAttr}`,
    ` class="slide-media-absolute"`,
    ` data-slide-media-index="${mediaIndex}"`,
    ` data-media-layout="x=${resolvedLayout.x};y=${resolvedLayout.y};w=${resolvedLayout.w};h=${resolvedLayout.h}"`,
    ` style="${mediaStyle(resolvedLayout)}">`,
  ].join("");
};

function sanitizeOptions(): sanitizeHtml.IOptions {
  let mediaIndex = 0;

  return {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "video", "source", "h1", "h2", "pre", "code", "span"]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title", "class", "data-slide-media-index", "data-media-layout", "style"],
      video: ["src", "title", "class", "controls", "playsinline", "preload", "data-slide-media-index", "data-media-layout", "style"],
      source: ["src", "type"],
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
      video: {
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
        const layout = parseMediaStyle(attribs.style) ?? parseMediaLayout(attribs.title ?? null) ?? { h: 34, w: 42, x: 29, y: 33 };
        const nextMediaIndex = mediaIndex;
        mediaIndex += 1;

        return {
          tagName,
          attribs: {
            ...attribs,
            class: [attribs.class, "slide-media-absolute"].filter(Boolean).join(" "),
            "data-slide-media-index": String(nextMediaIndex),
            "data-media-layout": `x=${layout.x};y=${layout.y};w=${layout.w};h=${layout.h}`,
            style: mediaStyle(layout),
          },
        };
      },
      video: (tagName, attribs) => {
        const layout = parseMediaStyle(attribs.style) ?? { h: 34, w: 42, x: 29, y: 33 };
        const nextMediaIndex = mediaIndex;
        mediaIndex += 1;

        return {
          tagName,
          attribs: {
            ...attribs,
            class: [attribs.class, "slide-media-absolute"].filter(Boolean).join(" "),
            controls: "controls",
            "data-slide-media-index": String(nextMediaIndex),
            "data-media-layout": `x=${layout.x};y=${layout.y};w=${layout.w};h=${layout.h}`,
            playsinline: "playsinline",
            preload: attribs.preload ?? "metadata",
            style: mediaStyle(layout),
          },
        };
      },
    },
  };
}

export function splitSlides(markdown: string) {
  return parseDeckMarkdown(markdown).body
    .split(slideSeparatorPattern)
    .map((slide) => slide.trim())
    .filter(Boolean);
}

export function splitEditableSlides(markdown: string) {
  const slides = parseDeckMarkdown(markdown).body.split(slideSeparatorPattern);
  return slides.length ? slides : [""];
}

export function joinEditableSlides(slides: string[], frontMatter?: string | null) {
  const body = slides.join("\n---\n");
  return frontMatter ? `${frontMatter}\n${body}` : body;
}

export function renderMarkdown(markdown: string) {
  return sanitizeHtml(md.render(markdown, { mediaIndex: 0 }), sanitizeOptions());
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

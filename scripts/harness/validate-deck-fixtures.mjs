import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const deckDir = path.join(repoRoot, "harness", "decks");
const supportedThemes = new Set(["light", "dark", "mint"]);
const slideSeparatorPattern = /\r?\n---[ \t]*(?:\r?\n|$)/g;

function parseFrontMatter(markdown) {
  const match = markdown.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    return {
      body: markdown,
      frontMatter: null,
      settings: { footer: "", header: "", theme: "light" },
    };
  }

  const settings = { footer: "", header: "", theme: "light" };
  for (const line of match[1].split(/\r?\n/)) {
    const lineMatch = line.match(/^\s*([A-Za-z][\w-]*)\s*:\s*(.*?)\s*$/);
    if (!lineMatch) continue;

    const key = lineMatch[1].toLowerCase();
    const value = unquote(lineMatch[2]);
    if (key === "theme") settings.theme = value.trim().toLowerCase();
    if (key === "header") settings.header = value;
    if (key === "footer") settings.footer = value;
  }

  return {
    body: markdown.slice(match[0].length),
    frontMatter: match[0].trimEnd(),
    settings,
  };
}

function unquote(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function splitSlides(markdown) {
  return parseFrontMatter(markdown).body
    .split(slideSeparatorPattern)
    .map((slide) => slide.trim())
    .filter(Boolean);
}

function countFenceMarkers(markdown) {
  return markdown.match(/```/g)?.length ?? 0;
}

function slideStats(markdown) {
  const bulletCount = markdown.split(/\r?\n/).filter((line) => /^\s*[-*+]\s+/.test(line)).length;
  const codeBlocks = [...markdown.matchAll(/```[\w-]*\n([\s\S]*?)```/g)];
  const maxCodeLines = codeBlocks.reduce((max, block) => {
    const lineCount = block[1].trimEnd().split(/\r?\n/).filter(Boolean).length;
    return Math.max(max, lineCount);
  }, 0);

  return {
    bulletCount,
    charCount: markdown.replace(/\s/g, "").length,
    maxCodeLines,
  };
}

function parseMediaLayouts(markdown) {
  const layouts = [];
  const titleMatches = markdown.matchAll(/\blt-media:([^\s")]+)/g);
  for (const match of titleMatches) {
    layouts.push({ source: "lt-media", value: parseLayoutParts(match[1], "=", ";") });
  }

  const styleMatches = markdown.matchAll(/style=["']([^"']*)["']/g);
  for (const match of styleMatches) {
    const style = Object.fromEntries(
      match[1]
        .split(";")
        .map((part) => part.split(":").map((value) => value.trim()))
        .filter(([key, value]) => key && value),
    );
    layouts.push({
      source: "style",
      value: {
        h: percentNumber(style.height),
        w: percentNumber(style.width),
        x: percentNumber(style.left),
        y: percentNumber(style.top),
      },
    });
  }

  return layouts;
}

function parseLayoutParts(value, separator, partSeparator) {
  return Object.fromEntries(
    value
      .split(partSeparator)
      .map((part) => part.split(separator))
      .map(([key, nextValue]) => [key, Number(nextValue)])
      .filter(([key, nextValue]) => key && Number.isFinite(nextValue)),
  );
}

function percentNumber(value) {
  return Number(String(value ?? "").replace(/%$/, ""));
}

function validateMediaLayout(layout) {
  const { h, w, x, y } = layout.value;
  const fields = { h, w, x, y };
  const missing = Object.entries(fields)
    .filter(([, value]) => !Number.isFinite(value))
    .map(([key]) => key);
  if (missing.length) {
    return `${layout.source} media layout is missing numeric ${missing.join(", ")}`;
  }
  if (x < 0 || y < 0 || w < 5 || h < 5 || x + w > 100 || y + h > 100) {
    return `${layout.source} media layout must stay inside the slide`;
  }
  return null;
}

function validateDeck(filename, markdown) {
  const failures = [];
  const parsed = parseFrontMatter(markdown);
  const slides = splitSlides(markdown);

  if (!parsed.frontMatter) {
    failures.push("missing front matter");
  }
  if (!supportedThemes.has(parsed.settings.theme)) {
    failures.push(`unsupported theme "${parsed.settings.theme}"`);
  }
  if (countFenceMarkers(markdown) % 2 !== 0) {
    failures.push("unbalanced code fences");
  }
  if (slides.length < 1) {
    failures.push("deck has no slides");
  }
  if (/<script\b/i.test(markdown)) {
    failures.push("raw script tags are not allowed in deck fixtures");
  }
  if (/\son[a-z]+\s*=/i.test(markdown)) {
    failures.push("inline event handlers are not allowed in deck fixtures");
  }

  slides.forEach((slide, index) => {
    const stats = slideStats(slide);
    const label = `slide ${index + 1}`;

    if (!/^#{1,3}\s+\S/m.test(slide) && stats.charCount > 80) {
      failures.push(`${label} should have a visible heading`);
    }
    if (stats.bulletCount > 8) {
      failures.push(`${label} has too many bullets (${stats.bulletCount})`);
    }
    if (stats.maxCodeLines > 16) {
      failures.push(`${label} code block is too tall (${stats.maxCodeLines} lines)`);
    }
    if (stats.charCount > 900) {
      failures.push(`${label} is too dense (${stats.charCount} non-space chars)`);
    }

    for (const layout of parseMediaLayouts(slide)) {
      const failure = validateMediaLayout(layout);
      if (failure) failures.push(`${label}: ${failure}`);
    }
  });

  return {
    failures,
    filename,
    slideCount: slides.length,
  };
}

async function main() {
  const entries = await readdir(deckDir, { withFileTypes: true });
  const markdownFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort();

  if (!markdownFiles.length) {
    throw new Error(`No deck fixtures found in ${path.relative(repoRoot, deckDir)}`);
  }

  const results = [];
  for (const filename of markdownFiles) {
    const markdown = await readFile(path.join(deckDir, filename), "utf8");
    results.push(validateDeck(filename, markdown));
  }

  let failureCount = 0;
  for (const result of results) {
    if (!result.failures.length) {
      console.log(`PASS ${result.filename} (${result.slideCount} slides)`);
      continue;
    }

    failureCount += result.failures.length;
    console.log(`FAIL ${result.filename} (${result.slideCount} slides)`);
    for (const failure of result.failures) {
      console.log(`  - ${failure}`);
    }
  }

  if (failureCount) {
    console.error(`Deck harness failed with ${failureCount} issue(s).`);
    process.exitCode = 1;
    return;
  }

  console.log(`Deck harness passed for ${results.length} fixture(s).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

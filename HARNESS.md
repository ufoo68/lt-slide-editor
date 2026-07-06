# Harness Engineering for LT Slide Editor

This project uses a lightweight deck harness to keep the core editing format
stable while the product changes.

## What The Harness Covers

- Markdown decks can be split into slides.
- Front matter uses supported deck settings.
- Each slide has a heading or intentional content.
- Slide density stays reasonable for lightning talks.
- Code fences are balanced.
- Media layout metadata stays inside slide bounds.
- Dangerous raw HTML patterns are caught before they become fixtures.

## Run It

```bash
npm run harness:decks
```

The command validates every Markdown file in `harness/decks`.

## How To Use It

When you add a feature that changes slide generation, rendering, media layout,
or AI deck output:

1. Save a representative deck in `harness/decks`.
2. Run `npm run harness:decks`.
3. Tighten the harness checks when a bug should never come back.

This is intentionally smaller than a full end-to-end suite. It is a stable
workbench for the riskiest boundary in this app: user or AI-authored Markdown
turning into editable slides.

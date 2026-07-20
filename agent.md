# Agent Operations

## Scope

This repository supports LT Slide Editor development and external Codex skill integration. The production app is available at:

```text
https://lt-slide-editor.ufoo68.com
```

Use `http://localhost:3000` only for local development.

## External Skill Flow

External Codex skills should not use Firebase user authentication. Use a deck-scoped token instead.

1. Save the target deck in LT Slide Editor.
2. Open the deck editor AI panel.
3. Issue a Deck token.
4. Pass that token to the external Codex workflow as `Authorization: Bearer ltsd.DECK_ID.SECRET`.
5. Call `POST /api/ai/deck-agent`.
6. Use `applyToDeck: true` only when the user wants the generated Markdown saved directly to the deck.

Deck tokens are scoped to a single deck. If a token appears in logs, chat, or a PR, revoke it from the AI panel and issue a new one.

## API Contract

Production endpoint:

```text
POST https://lt-slide-editor.ufoo68.com/api/ai/deck-agent
```

Typical request body:

```json
{
  "deckId": "DECK_ID",
  "language": "ja",
  "prompt": "7分LTとしてスライドを作成してください",
  "externalSkill": "# Optional skill guidance",
  "applyToDeck": true
}
```

`externalSkill` is guidance only. The app must not execute commands, access files, browse URLs, or use credentials from this field.

## Local Validation

Before opening a PR, run:

```bash
npm run typecheck
npm run lint
npm run build
```

For UI changes, start the app with:

```bash
npm run dev:local
```

Then verify `http://localhost:3000` responds.

## PR Workflow

Use the GitHub CLI (`gh`) from the beginning for all GitHub authentication, repository, issue, check, and pull-request operations. Do not try a GitHub app or connector first and then fall back to `gh`.

Before publishing changes, verify the CLI and authentication:

```bash
gh --version
gh auth status
gh repo view --json nameWithOwner,defaultBranchRef
```

Use a branch named `agent/<short-description>` from `master`.

Stage only intentional files. Do not include generated Next.js changes such as transient `next-env.d.ts` rewrites unless they are part of the requested work.

PR descriptions should include:

- what changed
- why it changed
- user/developer impact
- validation commands run

Open draft PRs with `gh pr create --draft` by default unless the user asks for ready-for-review. When the PR body is multiline, write it to a temporary Markdown file and pass it with `--body-file`.

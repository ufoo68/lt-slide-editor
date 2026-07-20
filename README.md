# LT Slide Editor

![LT Slide Editor icon](./public/lt-slide-editor-icon.svg)

LT Slide Editor is a Next.js App Router application for creating
lightning-talk slide decks in Markdown. Users sign in with Firebase
Authentication, and deck metadata is stored in Cloud Firestore.

## Local Setup

```bash
npm install
npm run local:up
npm run dev:local
```

Open `http://localhost:3000` in your browser. Node.js 24 LTS is expected.
If you use Volta, the project uses Node 24.15.0 from `package.json`.

Local development uses the Firebase Auth and Firestore emulators. Create `.env` from
`.env.example`; if you already have production or staging values, create
`.env.local` from `.env.local.example` to override them for local development.

To use Gemini fact checking with Google Search grounding, set
`GEMINI_API_KEY` in `.env.local`. The default model is
`gemini-2.5-flash`; override it with `GEMINI_MODEL` if needed.

## Codex / External Skill Access

For external slide-generation workflows, open a saved deck and issue a
Deck token from the AI panel. Codex can use it to read the current deck and
write completed Markdown directly without invoking Gemini.

```bash
curl "https://lt-slide-editor.ufoo68.com/api/ai/deck-agent?deckId=DECK_ID" \
  -H "Authorization: Bearer ltsd.DECK_ID.SECRET"

curl -X PUT https://lt-slide-editor.ufoo68.com/api/ai/deck-agent \
  -H "Authorization: Bearer ltsd.DECK_ID.SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "deckId": "DECK_ID",
    "markdown": "# Codexが作成した完成スライド",
    "notes": "7分LTとして直接作成"
}'
```

Use `http://localhost:3000` instead of `https://lt-slide-editor.ufoo68.com`
when testing against a local dev server.

`POST /api/ai/deck-agent` remains available for the editor's built-in Gemini
agent. External Codex skills should use GET and PUT so generation happens in
Codex and only deck storage happens in LT Slide Editor. Revoke and reissue the
Deck token from the AI panel if it is exposed.

## Common Commands

```bash
npm run local:up     # Start Firebase emulators and MinIO
npm run local:down   # Stop local services without deleting data
npm run local:destroy # Remove local service containers without deleting volumes
npm run local:logs   # Show logs for Firebase emulators and MinIO
npm run local:reset  # Recreate the Compose volumes
npm run check        # Run lint and typecheck
```

Compose volume names are pinned in `docker-compose.yml`, so local data
continues to use the same Firebase Emulator and MinIO
volumes even if the project is launched from a different directory name.
`local:reset` deletes Compose volumes, so local Firebase Emulator and
MinIO data will be removed. Back up any decks
or images you need first.

## Local Services

- App: `http://localhost:3000`
- Firebase Emulator UI: `http://localhost:4000`
- Firebase Auth API: `http://localhost:9099`
- Firestore API: `http://localhost:8080`
- MinIO Console: `http://localhost:9001`
- MinIO username/password: `minioadmin` / `minioadmin`
- Default image bucket: `lt-slide-editor`

Images uploaded to the image library are inserted as Markdown like this:

```html
<img
  src="/api/media/MEDIA_ID/file"
  alt="image.png"
  style="position:absolute;left:29%;top:33%;width:42%;height:34%;object-fit:contain;"
>
```

For production, set `STORAGE_BACKEND="gcs"` and `GCS_BUCKET_NAME` to store
images in Cloud Storage.

# LT Slide Editor

<p align="center">
  <img src="./public/lt-slide-editor-icon.svg" alt="LT Slide Editor icon" width="96" height="96">
</p>

LT Slide Editor is a Next.js App Router application for creating lightning-talk slide decks in Markdown. Users sign in with Firebase Authentication, decks are stored in PostgreSQL through Prisma.

### Local Setup

```bash
npm install
npm run local:up
npm run db:migrate
npm run dev:local
```

Open `http://localhost:3000` in your browser. Node.js 24 LTS is expected. If you use Volta, the project uses Node 24.15.0 from `package.json`.

Local development uses the Firebase Auth Emulator. Create `.env` from `.env.example`; if you already have production or staging values, create `.env.local` from `.env.local.example` to override them for local development.

To use Gemini LT review, set `GEMINI_API_KEY` in `.env.local`. The default model is `gemini-2.5-flash`; override it with `GEMINI_MODEL` if needed.

### Common Commands

```bash
npm run local:up     # Start PostgreSQL, Firebase Auth Emulator, and MinIO
npm run local:down   # Stop and remove the Compose environment
npm run local:logs   # Show logs for PostgreSQL, Firebase Auth Emulator, and MinIO
npm run local:reset  # Recreate the Compose volumes
npm run db:migrate   # Apply Prisma migrations
npm run check        # Run lint and typecheck
```

`local:reset` and `db:reset` delete Compose volumes, so local PostgreSQL, Firebase Auth Emulator, and MinIO data will be removed. Back up any decks or images you need first.

### Local Services

- App: `http://localhost:3000`
- Firebase Auth Emulator UI: `http://localhost:4000`
- Firebase Auth API: `http://localhost:9099`
- MinIO Console: `http://localhost:9001`
- MinIO username/password: `minioadmin` / `minioadmin`
- Default image bucket: `lt-slide-editor`

Images uploaded to the image library are inserted as Markdown like this:

```html
<img src="/api/images/IMAGE_ID/file" alt="image.png" style="position:absolute;left:29%;top:33%;width:42%;height:34%;object-fit:contain;">
```

For production, set `STORAGE_BACKEND="gcs"` and `GCS_BUCKET_NAME` to store images in Cloud Storage.

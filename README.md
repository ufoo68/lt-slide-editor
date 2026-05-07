# LT Slide Editor

<p align="center">
  <img src="./public/lt-slide-editor-icon.svg" alt="LT Slide Editor icon" width="96" height="96">
</p>

## 日本語

MarkdownでLT向けスライドを作るNext.js App Routerアプリです。Firebase Authenticationでログインし、Prisma経由でPostgreSQLにデッキを保存し、公開デッキは `/view/[slug]` で閲覧できます。アプリ内の表示言語はHeaderの **Language mode** で日本語/Englishを切り替えられます。

### 主な機能

- Firebase Authenticationのメール/パスワード、Googleログイン
- 発表用スライドの一覧、作成、編集、保存
- 共有スライドの作成と再利用
- Markdownを `---` で分割したリアルタイムプレビュー
- `markdown-it` + `highlight.js` によるコードハイライト
- `sanitize-html` によるHTML sanitize
- 公開/非公開切り替え、公開URL閲覧
- 発表時間の設定と発表画面でのカウントダウン
- LT向け警告: 文字数、箇条書き数、スライド枚数、コードブロック行数
- 画像ライブラリ、`<img>` Markdown挿入、ドラッグによる位置調整
- ローカルMinIO / 本番Cloud Storage用ヘルパー `lib/storage.ts`

### ローカル起動

```bash
npm install
npm run local:up
npm run db:migrate
npm run dev:local
```

ブラウザで `http://localhost:3000` を開きます。Node.jsは24系LTSを想定しています。Voltaを使う場合は `package.json` の設定でNode 24.15.0が選ばれます。

ローカル開発ではFirebase Auth Emulatorを使います。`.env.example` を元に `.env` を作成し、必要に応じて `.env.local.example` を元に `.env.local` を作るとローカル用の値で上書きできます。

### よく使うコマンド

```bash
npm run local:up     # PostgreSQL、Firebase Auth Emulator、MinIOを起動
npm run local:down   # Compose環境を停止・削除
npm run local:logs   # PostgreSQL、Firebase Auth Emulator、MinIOのログ表示
npm run local:reset  # Compose volumeごと削除して作り直し
npm run db:migrate   # Prisma migrationを適用
npm run check        # lintとtypecheck
```

`local:reset` と `db:reset` はComposeのvolumeを削除するため、PostgreSQL、Firebase Auth Emulator、MinIOのローカルデータが消えます。必要なデッキや画像がある場合は先に退避してください。

### ローカルサービス

- App: `http://localhost:3000`
- Firebase Auth Emulator UI: `http://localhost:4000`
- Firebase Auth API: `http://localhost:9099`
- MinIO Console: `http://localhost:9001`
- MinIOユーザー名/パスワード: `minioadmin` / `minioadmin`
- 既定の画像バケット: `lt-slide-editor`

画像ライブラリにアップロードした画像は、Markdownでは次のような形で挿入されます。

```html
<img src="/api/images/IMAGE_ID/file" alt="image.png" style="position:absolute;left:29%;top:33%;width:42%;height:34%;object-fit:contain;">
```

本番環境では `STORAGE_BACKEND="gcs"` と `GCS_BUCKET_NAME` を設定してCloud Storageへ保存します。

### 主要ファイル

- `prisma/schema.prisma`: User、Deck、DeckVersion、DeckAsset、DeckExport
- `app/presentations`: 発表用スライドの作成・編集画面
- `app/shared-slides`: 共有スライドの作成・編集画面
- `app/view`: 公開スライドの閲覧画面
- `app/api/presentations`: 認証付き発表用スライドAPI
- `app/api/images`: 認証付き画像ライブラリAPI
- `components/DeckEditor.tsx`: Markdown編集、プレビュー、公開切り替え、LTチェック
- `lib/i18n.tsx`: 日本語/Englishの表示文言とLanguage mode
- `lib/markdown.ts`: 分割、HTML変換、sanitize、警告生成

## English

LT Slide Editor is a Next.js App Router application for creating lightning-talk slide decks in Markdown. Users sign in with Firebase Authentication, decks are stored in PostgreSQL through Prisma, and public decks are available at `/view/[slug]`. The app language can be switched between Japanese and English from **Language mode** in the header.

### Features

- Email/password and Google sign-in with Firebase Authentication
- List, create, edit, and save presentation decks
- Create and reuse shared slides
- Real-time preview by splitting Markdown with `---`
- Code highlighting with `markdown-it` and `highlight.js`
- HTML sanitization with `sanitize-html`
- Public/private visibility and public URL viewing
- Presentation duration setting and countdown timer in presentation view
- Lightning-talk warnings for text length, bullet count, slide count, and code block length
- Image library, `<img>` Markdown insertion, and drag-based image positioning
- Storage helper in `lib/storage.ts` for local MinIO and production Cloud Storage

### Local Setup

```bash
npm install
npm run local:up
npm run db:migrate
npm run dev:local
```

Open `http://localhost:3000` in your browser. Node.js 24 LTS is expected. If you use Volta, the project uses Node 24.15.0 from `package.json`.

Local development uses the Firebase Auth Emulator. Create `.env` from `.env.example`; if you already have production or staging values, create `.env.local` from `.env.local.example` to override them for local development.

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

### Key Files

- `prisma/schema.prisma`: User, Deck, DeckVersion, DeckAsset, DeckExport
- `app/presentations`: Create and edit presentation decks
- `app/shared-slides`: Create and edit shared slides
- `app/view`: Public slide viewer
- `app/api/presentations`: Authenticated presentation API
- `app/api/images`: Authenticated image library API
- `components/DeckEditor.tsx`: Markdown editing, preview, visibility switch, and LT checks
- `lib/i18n.tsx`: Japanese/English UI copy and Language mode
- `lib/markdown.ts`: Splitting, HTML rendering, sanitization, and warning generation

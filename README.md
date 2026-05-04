# LT Slide Editor

MarkdownでLT向けスライドを作るNext.js App Router MVPです。Firebase Authenticationでログインし、Prisma経由でPostgreSQLにデッキを保存し、公開デッキは `/p/[slug]` で閲覧できます。

## MVP機能

- Firebase Authenticationのメール/パスワード、Googleログイン
- 自分のデッキ一覧、作成、編集、保存
- Markdownを `---` で分割したリアルタイムプレビュー
- `markdown-it` + `highlight.js` によるコードハイライト
- `sanitize-html` によるHTML sanitize
- 公開/非公開切り替え、公開URL閲覧
- LT向け警告: 文字数、箇条書き数、スライド枚数、コードブロック行数
- Prisma schema、migration
- Cloud Storage Signed URL用ヘルパー `lib/storage.ts`

## ローカル起動

1. 依存関係をインストールします。

```bash
npm install
```

Node.jsは24系LTSを想定しています。Voltaを使う場合は `package.json` の設定でNode 24.15.0が選ばれます。

2. `.env.example` を元に `.env` を作成します。ローカル開発ではFirebase Auth Emulatorを使うため、実Firebaseプロジェクトのサービスアカウント鍵は不要です。既に本番/ステージング向けの `.env` がある場合は、`.env.local.example` を元に `.env.local` を作るとローカル用の値で上書きできます。

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/lt_slide_editor?schema=public"
NEXT_PUBLIC_FIREBASE_API_KEY="demo-api-key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="localhost"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="demo-lt-slide-editor"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="demo-lt-slide-editor.appspot.com"
NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST="localhost:9099"
FIREBASE_PROJECT_ID="demo-lt-slide-editor"
FIREBASE_AUTH_EMULATOR_HOST="localhost:9099"
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
GCS_BUCKET_NAME=""
```

3. Docker ComposeでローカルPostgreSQLとFirebase Auth Emulatorを起動し、Prisma migrationを適用します。

```bash
npm run local:up
npm run db:migrate
```

4. 開発サーバーを起動します。

```bash
npm run dev:local
```

ブラウザで `http://localhost:3000` を開きます。

ローカル開発では `npm run build` を毎回実行する必要はありません。`next dev` は変更をオンデマンドに再コンパイルするため、画面確認は `npm run dev:local` を起動したまま行います。型とlintの確認は次を使います。

```bash
npm run check
```

`npm run build` は本番ビルドを確認したい時に実行します。

## ローカルDocker

Docker ComposeでPostgreSQL 16とFirebase Auth Emulatorを起動します。DB名は `lt_slide_editor`、ユーザーとパスワードはどちらも `postgres` です。

```bash
npm run local:up
npm run db:status
npm run db:migrate
```

よく使うコマンド:

```bash
npm run local:up     # PostgreSQLとFirebase Auth Emulatorを起動
npm run local:down   # Compose環境を停止・削除
npm run local:logs   # PostgreSQLとFirebase Auth Emulatorのログ表示
npm run local:reset  # Compose volumeごと削除して作り直し
npm run db:up        # PostgreSQLだけ起動
npm run db:down      # PostgreSQLだけ停止
npm run db:restart   # PostgreSQLだけ再起動
npm run db:logs      # PostgreSQLだけログ表示
npm run db:status    # PostgreSQLの状態表示
npm run db:studio    # Prisma Studio
```

`local:reset` と `db:reset` はローカルDBのデータを削除します。必要なデッキがある場合は先に退避してください。

## ローカルFirebase Auth

ローカル開発ではDocker ComposeでFirebase Auth Emulatorを起動します。実Firebase Authenticationには接続しません。

```bash
npm run local:up
npm run local:logs
npm run local:down
```

Auth Emulator UIは `http://localhost:4000`、Auth APIは `http://localhost:9099` です。`.env` に `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST` と `FIREBASE_AUTH_EMULATOR_HOST` がある場合、ブラウザ側Firebase SDKとサーバー側Firebase Admin SDKの両方がエミュレータへ接続します。

ローカルではメール/パスワードの新規登録とログインを使ってください。Googleログインは実Firebaseプロジェクト側のOAuth設定に依存するため、ローカル用の標準フローからは外しています。

PostgreSQLとAuth Emulatorのデータをまとめて消して作り直す場合は次を実行します。

```bash
npm run local:reset
```

## Firebase設定

本番やステージングではFirebase ConsoleでWebアプリを作成し、Authenticationのメール/パスワードとGoogleログインを有効化します。クライアント設定を `NEXT_PUBLIC_FIREBASE_*` に入れ、サーバー側のID token検証用にサービスアカウントの `project_id`、`client_email`、`private_key` を `FIREBASE_*` に設定します。本番環境では `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST` と `FIREBASE_AUTH_EMULATOR_HOST` を設定しないでください。

## 主要ファイル

- `prisma/schema.prisma`: User、Deck、DeckVersion、DeckAsset、DeckExport
- `app/api/decks`: 認証付きデッキAPI
- `components/DeckEditor.tsx`: Markdown編集、プレビュー、公開切り替え、LTチェック
- `lib/markdown.ts`: 分割、HTML変換、sanitize、警告生成

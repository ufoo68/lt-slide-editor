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
- Prisma schema、migration、Cloud Run向けDockerfile
- Cloud Storage Signed URL用ヘルパー `lib/storage.ts`

## ローカル起動

1. 依存関係をインストールします。

```bash
npm install
```

2. `.env.example` を元に `.env` を作成します。

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/lt_slide_editor?schema=public"
NEXT_PUBLIC_FIREBASE_API_KEY="..."
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="..."
NEXT_PUBLIC_FIREBASE_PROJECT_ID="..."
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="..."
FIREBASE_PROJECT_ID="..."
FIREBASE_CLIENT_EMAIL="..."
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GCS_BUCKET_NAME=""
```

3. ローカルPostgreSQLを起動し、Prisma migrationを適用します。

```bash
npm run db:up
npm run db:migrate
```

4. 開発サーバーを起動します。

```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開きます。

## ローカルDB

DockerでPostgreSQL 16を起動します。Windowsでは `package.json` のnpm scriptsから `scripts/local-db.ps1` を実行します。コンテナ名は `lt-slide-editor-postgres`、DB名は `lt_slide_editor`、ユーザーとパスワードはどちらも `postgres` です。

```bash
npm run db:up
npm run db:status
npm run db:migrate
```

よく使うコマンド:

```bash
npm run db:up       # 起動
npm run db:down     # 停止
npm run db:restart  # 再起動
npm run db:logs     # ログ表示
npm run db:status   # 状態とDATABASE_URL表示
npm run db:reset    # コンテナ削除後に作り直し
npm run db:studio   # Prisma Studio
```

`db:reset` はローカルDBのデータを削除します。必要なデッキがある場合は先に退避してください。

## Firebase設定

Firebase ConsoleでWebアプリを作成し、Authenticationのメール/パスワードとGoogleログインを有効化します。クライアント設定を `NEXT_PUBLIC_FIREBASE_*` に入れ、サーバー側のID token検証用にサービスアカウントの `project_id`、`client_email`、`private_key` を `FIREBASE_*` に設定します。

## Cloud SQL for PostgreSQL

Cloud RunからCloud SQLへ接続する場合、Cloud RunサービスにCloud SQL接続を追加し、Unix socket形式の `DATABASE_URL` を設定できます。

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost/DB_NAME?host=/cloudsql/PROJECT_ID:REGION:INSTANCE_NAME"
```

Cloud SQL Auth Proxyを使うローカル開発では、通常のlocalhost接続文字列で動かせます。

## Cloud Runデプロイ

Artifact Registryを作成済みとして、以下の流れでデプロイできます。

```bash
gcloud builds submit --tag REGION-docker.pkg.dev/PROJECT_ID/REPOSITORY/lt-slide-editor:latest
gcloud run deploy lt-slide-editor \
  --image REGION-docker.pkg.dev/PROJECT_ID/REPOSITORY/lt-slide-editor:latest \
  --region REGION \
  --allow-unauthenticated \
  --add-cloudsql-instances PROJECT_ID:REGION:INSTANCE_NAME \
  --set-env-vars NEXT_PUBLIC_FIREBASE_API_KEY=... \
  --set-env-vars NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=... \
  --set-env-vars NEXT_PUBLIC_FIREBASE_PROJECT_ID=... \
  --set-env-vars NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=... \
  --set-env-vars FIREBASE_PROJECT_ID=... \
  --set-env-vars FIREBASE_CLIENT_EMAIL=... \
  --set-env-vars GCS_BUCKET_NAME=... \
  --set-secrets DATABASE_URL=DATABASE_URL:latest,FIREBASE_PRIVATE_KEY=FIREBASE_PRIVATE_KEY:latest
```

本番DBにはデプロイ前後でmigrationを適用します。Cloud Run Job、Cloud Build step、または一時的な管理端末から次を実行してください。

```bash
npm run prisma:deploy
```

## 主要ファイル

- `prisma/schema.prisma`: User、Deck、DeckVersion、DeckAsset、DeckExport
- `app/api/decks`: 認証付きデッキAPI
- `components/DeckEditor.tsx`: Markdown編集、プレビュー、公開切り替え、LTチェック
- `lib/markdown.ts`: 分割、HTML変換、sanitize、警告生成
- `Dockerfile`: Next.js standaloneをCloud Runで動かすコンテナ

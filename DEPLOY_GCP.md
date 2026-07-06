# GCP Deploy

Cloud Run + Cloud Firestore + Cloud Storage にデプロイする手順です。

## 前提

- Google Cloud CLI (`gcloud`) が使えること
- Firebase Authentication の Web アプリ設定があること
- Cloud Firestore のデータベースがあること
- Cloud Storage のメディア保存用バケットがあること
- Artifact Registry の Docker リポジトリがあること
- Gemini API キーがあること

## 変数例

```powershell
$PROJECT_ID = "your-project"
$REGION = "asia-northeast1"
$SERVICE = "lt-slide-editor"
$REPOSITORY = "apps"
$IMAGE = "$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/${SERVICE}:latest"
$GCS_BUCKET_NAME = "lt-slide-editor-media"
$GEMINI_MODEL = "gemini-2.5-flash"
$NEXT_PUBLIC_FIREBASE_API_KEY = "..."
$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "$PROJECT_ID.firebaseapp.com"
$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "$PROJECT_ID.appspot.com"
```

PowerShell では `$SERVICE:latest` が変数スコープのように解釈されるため、Docker image tag は `${SERVICE}:latest` の形で組み立てます。

`NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` は Firebase client 初期化用の値です。メディア保存先の `GCS_BUCKET_NAME` とは別で、Firebase Console の Web app config に表示される `storageBucket` をそのまま使います。プロジェクトによっては `PROJECT_ID.firebasestorage.app` の形式の場合もあります。

## 初回だけ

```powershell
gcloud config set project $PROJECT_ID
gcloud services enable `
  run.googleapis.com `
  cloudbuild.googleapis.com `
  artifactregistry.googleapis.com `
  secretmanager.googleapis.com `
  firestore.googleapis.com `
  storage.googleapis.com

gcloud artifacts repositories create $REPOSITORY `
  --repository-format=docker `
  --location=$REGION

gcloud firestore databases create `
  --database="(default)" `
  --location=$REGION

gcloud storage buckets create "gs://$GCS_BUCKET_NAME" `
  --project=$PROJECT_ID `
  --location=$REGION `
  --uniform-bucket-level-access
```

すでに Firestore の default database がある場合、`gcloud firestore databases create` は不要です。Firebase Console から Cloud Firestore を有効化しても構いません。

Secret Manager には Gemini API キーだけを入れます。Firestore は Cloud Run の Application Default Credentials でアクセスするため、DB 接続文字列は不要です。

```powershell
$GEMINI_API_KEY = "..."
$GEMINI_API_KEY | gcloud secrets create GEMINI_API_KEY --data-file=-
```

すでに secret がある場合は、`create` ではなく新しい version を追加します。

```powershell
$GEMINI_API_KEY | gcloud secrets versions add GEMINI_API_KEY --data-file=-
```

Cloud Run の実行サービスアカウントが Secret Manager、Firestore、Cloud Storage を使えるようにします。デフォルトの Compute Engine サービスアカウントを使う場合は次の形です。

```powershell
$PROJECT_NUMBER = gcloud projects describe $PROJECT_ID --format="value(projectNumber)"
$CLOUD_RUN_SERVICE_ACCOUNT = "$PROJECT_NUMBER-compute@developer.gserviceaccount.com"

gcloud secrets add-iam-policy-binding GEMINI_API_KEY `
  --member="serviceAccount:$CLOUD_RUN_SERVICE_ACCOUNT" `
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding $PROJECT_ID `
  --member="serviceAccount:$CLOUD_RUN_SERVICE_ACCOUNT" `
  --role="roles/datastore.user"

gcloud storage buckets add-iam-policy-binding "gs://$GCS_BUCKET_NAME" `
  --member="serviceAccount:$CLOUD_RUN_SERVICE_ACCOUNT" `
  --role="roles/storage.objectAdmin"
```

メディアアップロードは Firebase Storage ではなく `GCS_BUCKET_NAME` の Cloud Storage bucket に保存します。Firebase Storage を有効化する必要はありません。

## ビルド

```powershell
gcloud builds submit --tag $IMAGE
```

## Cloud Run へデプロイ

```powershell
gcloud run deploy $SERVICE `
  --image $IMAGE `
  --region $REGION `
  --allow-unauthenticated `
  --port 8080 `
  --set-env-vars NEXT_PUBLIC_FIREBASE_API_KEY="$NEXT_PUBLIC_FIREBASE_API_KEY" `
  --set-env-vars NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN" `
  --set-env-vars NEXT_PUBLIC_FIREBASE_PROJECT_ID="$PROJECT_ID" `
  --set-env-vars NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET" `
  --set-env-vars FIREBASE_PROJECT_ID="$PROJECT_ID" `
  --set-env-vars GEMINI_MODEL="$GEMINI_MODEL" `
  --set-env-vars STORAGE_BACKEND="gcs" `
  --set-env-vars GCS_BUCKET_NAME="$GCS_BUCKET_NAME" `
  --set-secrets "GEMINI_API_KEY=GEMINI_API_KEY:latest"
```

Cloud Run 上では Firebase Admin SDK は Application Default Credentials で初期化されるため、通常は `FIREBASE_CLIENT_EMAIL` と `FIREBASE_PRIVATE_KEY` は不要です。

## CI/CD

GitHub Actions で CI と Cloud Run への CD を実行します。

- `.github/workflows/ci.yml`: `push` / `pull_request` で `npm ci`、lint、typecheck を実行します。
- `.github/workflows/deploy-gcp.yml`: `master` への `push` または手動実行で、Docker image の作成、Artifact Registry への push、Cloud Run deploy を実行します。

GitHub Repository Variables に次を設定します。

```text
GCP_PROJECT_ID=your-project
GCP_REGION=asia-northeast1
CLOUD_RUN_SERVICE=lt-slide-editor
ARTIFACT_REGISTRY_REPOSITORY=apps
GCS_BUCKET_NAME=lt-slide-editor-media
GEMINI_MODEL=gemini-2.5-flash
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=PROJECT_ID.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=PROJECT_ID.appspot.com
FIREBASE_PROJECT_ID=PROJECT_ID
```

GitHub Repository Secrets に次を設定します。

```text
GCP_WORKLOAD_IDENTITY_PROVIDER=projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_ID/providers/PROVIDER_ID
GCP_SERVICE_ACCOUNT=github-deploy@PROJECT_ID.iam.gserviceaccount.com
```

Workload Identity Federation を使うため、GitHub Actions から使うサービスアカウントには少なくとも次の権限を付与します。

```text
roles/run.admin
roles/artifactregistry.writer
roles/iam.serviceAccountUser
roles/serviceusage.serviceUsageConsumer
```

Cloud Run 実行サービスアカウントを別に指定する場合は、その実行サービスアカウントにも `roles/datastore.user`、Secret Manager の secret accessor、Cloud Storage bucket の object admin を付与してください。

## Firestore

このアプリは Prisma migration を使いません。Firestore のコレクションはアプリの初回書き込み時に自動作成されます。

主なコレクション:

- `users`
- `decks`
- `deckVersions`
- `slideLibraryItems`
- `mediaLibraryItems`

現在の実装はユーザー単位の取得後にアプリ側で `updatedAt` / `createdAt` の並び替えをするため、追加の composite index は不要です。大量データで一覧取得が重くなってきたら、`userId + updatedAt` などの composite index を作り、クエリ側を `orderBy` に寄せてください。

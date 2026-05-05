# GCP Deploy

Cloud Run + Supabase Postgres + Cloud Storageにデプロイする手順です。

## 前提

- Google Cloud CLI (`gcloud`) が使えること
- Firebase AuthenticationのWebアプリ設定があること
- SupabaseプロジェクトとPostgres接続文字列があること
- Cloud Storageの画像保存用バケットがあること
- Artifact RegistryのDockerリポジトリがあること

## 変数例

```powershell
$PROJECT_ID = "your-project"
$REGION = "asia-northeast1"
$SERVICE = "lt-slide-editor"
$REPOSITORY = "apps"
$IMAGE = "$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/$SERVICE:latest"
$GCS_BUCKET_NAME = "lt-slide-editor-images"
```

Supabaseの `DATABASE_URL` は、SupabaseのConnection Pooler用URLを使います。Cloud Runのようなサーバーレス環境ではpooler経由にして、接続数を絞るのがおすすめです。

```text
postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

Prisma migration用には、direct/session側の接続文字列を `DIRECT_URL` として別に設定します。

```text
postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres
```

## 初回だけ

```powershell
gcloud config set project $PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com

gcloud artifacts repositories create $REPOSITORY `
  --repository-format=docker `
  --location=$REGION
```

Secret ManagerにDB接続文字列を入れます。

```powershell
$DATABASE_URL = "postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
$DATABASE_URL | gcloud secrets create DATABASE_URL --data-file=-

$DIRECT_URL = "postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres"
$DIRECT_URL | gcloud secrets create DIRECT_URL --data-file=-
```

## ビルド

```powershell
gcloud builds submit --tag $IMAGE
```

## Cloud Runへデプロイ

```powershell
gcloud run deploy $SERVICE `
  --image $IMAGE `
  --region $REGION `
  --allow-unauthenticated `
  --port 8080 `
  --set-env-vars NEXT_PUBLIC_FIREBASE_API_KEY=... `
  --set-env-vars NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=PROJECT_ID.firebaseapp.com `
  --set-env-vars NEXT_PUBLIC_FIREBASE_PROJECT_ID=$PROJECT_ID `
  --set-env-vars NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=PROJECT_ID.appspot.com `
  --set-env-vars FIREBASE_PROJECT_ID=$PROJECT_ID `
  --set-env-vars STORAGE_BACKEND=gcs `
  --set-env-vars GCS_BUCKET_NAME=$GCS_BUCKET_NAME `
  --set-secrets DATABASE_URL=DATABASE_URL:latest
```

Cloud Run上ではFirebase Admin SDKはApplication Default Credentialsで初期化されるため、通常は `FIREBASE_CLIENT_EMAIL` と `FIREBASE_PRIVATE_KEY` は不要です。

## CI/CD

GitHub ActionsでCIとCloud RunへのCDを実行します。

- `.github/workflows/ci.yml`: `push` / `pull_request` で `npm ci`、Prisma Client生成、lint、typecheckを実行します。
- `.github/workflows/deploy-gcp.yml`: `master` への `push` または手動実行で、Cloud BuildによるDockerイメージ作成、Prisma migration、Cloud Runデプロイを実行します。

GitHub Repository Variablesに次を設定します。

```text
GCP_PROJECT_ID=your-project
GCP_REGION=asia-northeast1
CLOUD_RUN_SERVICE=lt-slide-editor
ARTIFACT_REGISTRY_REPOSITORY=apps
GCS_BUCKET_NAME=lt-slide-editor-images
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=PROJECT_ID.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=PROJECT_ID.appspot.com
FIREBASE_PROJECT_ID=PROJECT_ID
```

GitHub Repository Secretsに次を設定します。

```text
GCP_WORKLOAD_IDENTITY_PROVIDER=projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_ID/providers/PROVIDER_ID
GCP_SERVICE_ACCOUNT=github-deploy@PROJECT_ID.iam.gserviceaccount.com
```

Workload Identity Federationを使うため、GitHub Actionsから使うサービスアカウントには少なくとも次の権限を付与します。

```text
roles/run.admin
roles/cloudbuild.builds.editor
roles/artifactregistry.writer
roles/iam.serviceAccountUser
roles/secretmanager.secretAccessor
```

Cloud Run実行サービスアカウントを別に指定する場合は、その実行サービスアカウントにもSecret ManagerとCloud Storageへアクセスできる権限を付与してください。

## Migration

Supabase Postgresに対してmigrationを実行するには、`DATABASE_URL` にpooler接続文字列、`DIRECT_URL` にdirect/session側の接続文字列を設定した環境で次を実行します。

```powershell
npm run prisma:deploy
```

CI/CDではCloud Run Jobとして、同じイメージに `DATABASE_URL` と `DIRECT_URL` secretを設定し、コマンドを `npm run prisma:deploy` にして実行します。

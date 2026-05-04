# GCP Deploy

Cloud Run + Cloud SQL for PostgreSQLにデプロイする手順です。

## 前提

- Google Cloud CLI (`gcloud`) が使えること
- Firebase AuthenticationのWebアプリ設定があること
- Cloud SQL for PostgreSQLのインスタンス、DB、ユーザーがあること
- Cloud Storageの画像保存用バケットがあること
- Artifact RegistryのDockerリポジトリがあること

## 変数例

```powershell
$PROJECT_ID = "your-project"
$REGION = "asia-northeast1"
$SERVICE = "lt-slide-editor"
$REPOSITORY = "apps"
$IMAGE = "$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/$SERVICE:latest"
$CLOUD_SQL_INSTANCE = "$PROJECT_ID:$REGION:lt-slide-editor-db"
$GCS_BUCKET_NAME = "lt-slide-editor-images"
```

Cloud SQL Unix socket用の `DATABASE_URL` は次の形です。

```text
postgresql://USER:PASSWORD@localhost/DB_NAME?host=/cloudsql/PROJECT_ID:REGION:INSTANCE_NAME
```

## 初回だけ

```powershell
gcloud config set project $PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com sqladmin.googleapis.com secretmanager.googleapis.com

gcloud artifacts repositories create $REPOSITORY `
  --repository-format=docker `
  --location=$REGION
```

Secret ManagerにDB接続文字列を入れます。

```powershell
$DATABASE_URL = "postgresql://USER:PASSWORD@localhost/DB_NAME?host=/cloudsql/$CLOUD_SQL_INSTANCE"
$DATABASE_URL | gcloud secrets create DATABASE_URL --data-file=-
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
  --add-cloudsql-instances $CLOUD_SQL_INSTANCE `
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

## Migration

Cloud SQLに対してmigrationを実行するには、Cloud SQLへ接続できる環境で次を実行します。

```powershell
npm run prisma:deploy
```

Cloud Run Jobとして実行する場合は、同じイメージに `DATABASE_URL` secret とCloud SQL接続を設定し、コマンドを `npm run prisma:deploy` にします。

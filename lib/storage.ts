import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Storage } from "@google-cloud/storage";
import { Readable } from "stream";

const gcsStorage = new Storage();
const defaultLocalS3 = process.env.NODE_ENV !== "production";
const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT || (defaultLocalS3 ? "http://localhost:9000" : undefined),
  forcePathStyle: Boolean(process.env.S3_ENDPOINT || defaultLocalS3),
  region: process.env.S3_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "minioadmin",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "minioadmin",
  },
});

type StoredObject = {
  body: Blob;
  contentType: string;
};

function storageBackend() {
  if (process.env.STORAGE_BACKEND) {
    return process.env.STORAGE_BACKEND === "s3" ? "s3" : "gcs";
  }
  return defaultLocalS3 ? "s3" : "gcs";
}

export function deckAssetPath(deckId: string, filename: string) {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `decks/${deckId}/assets/${Date.now()}-${safeName}`;
}

export function imageLibraryPath(userId: string, filename: string) {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `users/${userId}/images/${Date.now()}-${safeName}`;
}

function gcsBucketName() {
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!bucketName) {
    throw new Error("GCS_BUCKET_NAME is not configured");
  }
  return bucketName;
}

function s3BucketName() {
  const bucketName = process.env.S3_BUCKET_NAME || (defaultLocalS3 ? "lt-slide-editor" : undefined);
  if (!bucketName) {
    throw new Error("S3_BUCKET_NAME is not configured");
  }
  return bucketName;
}

async function readableToBuffer(readable: Readable) {
  const chunks: Buffer[] = [];
  for await (const chunk of readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function uploadObject(storagePath: string, data: Buffer, contentType: string) {
  if (storageBackend() === "s3") {
    await s3Client.send(
      new PutObjectCommand({
        Body: data,
        Bucket: s3BucketName(),
        ContentType: contentType,
        Key: storagePath,
      }),
    );
    return;
  }

  await gcsStorage.bucket(gcsBucketName()).file(storagePath).save(data, {
    contentType,
    resumable: false,
  });
}

export async function readObject(storagePath: string): Promise<StoredObject> {
  if (storageBackend() === "s3") {
    const result = await s3Client.send(
      new GetObjectCommand({
        Bucket: s3BucketName(),
        Key: storagePath,
      }),
    );
    const body = result.Body instanceof Readable ? await readableToBuffer(result.Body) : Buffer.from([]);
    const contentType = result.ContentType || "application/octet-stream";
    return {
      body: new Blob([new Uint8Array(body)], { type: contentType }),
      contentType,
    };
  }

  const file = gcsStorage.bucket(gcsBucketName()).file(storagePath);
  const [metadata] = await file.getMetadata();
  const [body] = await file.download();
  const contentType = metadata.contentType || "application/octet-stream";
  return {
    body: new Blob([new Uint8Array(body)], { type: contentType }),
    contentType,
  };
}

export async function deleteObject(storagePath: string) {
  if (storageBackend() === "s3") {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: s3BucketName(),
        Key: storagePath,
      }),
    );
    return;
  }

  await gcsStorage.bucket(gcsBucketName()).file(storagePath).delete({ ignoreNotFound: true });
}

export async function createSignedReadUrl(storagePath: string, expiresInMinutes = 15) {
  if (storageBackend() === "s3") {
    return `/api/images/file?path=${encodeURIComponent(storagePath)}`;
  }

  const [url] = await gcsStorage
    .bucket(gcsBucketName())
    .file(storagePath)
    .getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + expiresInMinutes * 60 * 1000,
    });

  return url;
}

import { Storage } from "@google-cloud/storage";

const storage = new Storage();

export function deckAssetPath(deckId: string, filename: string) {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `decks/${deckId}/assets/${Date.now()}-${safeName}`;
}

export async function createSignedReadUrl(storagePath: string, expiresInMinutes = 15) {
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!bucketName) {
    throw new Error("GCS_BUCKET_NAME is not configured");
  }

  const [url] = await storage
    .bucket(bucketName)
    .file(storagePath)
    .getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + expiresInMinutes * 60 * 1000,
    });

  return url;
}

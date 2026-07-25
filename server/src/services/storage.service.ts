import { randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "../env.js";

// Object storage is optional: with no S3/R2 config, images stay inline as data
// URLs (the default). When configured, uploads go to the bucket and we store a
// small public URL instead — much kinder to the database.
export const storageEnabled = Boolean(
  env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY && env.S3_PUBLIC_URL,
);

const client = storageEnabled
  ? new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID!,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
      },
    })
  : null;

const DATA_URL_RE = /^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/;

/**
 * Uploads a base64 data URL to object storage and returns its public URL.
 * If storage isn't configured, returns the data URL unchanged (inline fallback).
 */
export async function uploadDataUrl(dataUrl: string): Promise<string> {
  if (!storageEnabled || !client) return dataUrl;

  const match = DATA_URL_RE.exec(dataUrl);
  if (!match) return dataUrl; // not a data URL (already a hosted URL) — leave as-is

  const contentType = match[1];
  const ext = match[2] === "jpeg" ? "jpg" : match[2];
  const body = Buffer.from(match[3], "base64");
  const key = `images/${randomUUID()}.${ext}`;

  await client.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return `${env.S3_PUBLIC_URL!.replace(/\/$/, "")}/${key}`;
}

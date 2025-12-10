// lib/s3Client.js
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

// Let AWS SDK v3 use its default credential provider chain
// (env vars, ~/.aws/credentials, etc). Don't pass a broken
// credentials object yourself.
const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-2",
});

/**
 * Fetch an object from the "model" bucket and return it as a UTF-8 string.
 * Default bucket: sharpsignal-ml-models
 */
export async function getObjectText(Key) {
  const Bucket = process.env.AWS_S3_MODEL_BUCKET || "sharpsignal-ml-models";
  const res = await s3.send(new GetObjectCommand({ Bucket, Key }));
  const chunks = [];
  for await (const chunk of res.Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

/**
 * Fetch an object from the "data" bucket (raw / metrics) and return it as UTF-8.
 * Default bucket: sharpsignal-ml-data
 */
export async function getDataObjectText(Key) {
  const Bucket = process.env.SHARPSIGNAL_DATA_BUCKET || "sharpsignal-ml-data";
  const res = await s3.send(new GetObjectCommand({ Bucket, Key }));
  const chunks = [];
  for await (const chunk of res.Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

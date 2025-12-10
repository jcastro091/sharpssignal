// lib/s3Client.js
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * Fetch an object from S3 and return it as a UTF-8 string.
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

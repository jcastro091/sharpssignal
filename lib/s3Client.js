// lib/s3Client.js
import { S3Client, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3"; // <-- add ListObjectsV2Command

const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-2",
});

export async function getObjectText(Key) {
  const Bucket = process.env.AWS_S3_MODEL_BUCKET || "sharpsignal-ml-models";
  const res = await s3.send(new GetObjectCommand({ Bucket, Key }));
  const chunks = [];
  for await (const chunk of res.Body) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf-8");
}

export async function getDataObjectText(Key) {
  const Bucket = process.env.SHARPSIGNAL_DATA_BUCKET || "sharpsignal-ml-data";
  const res = await s3.send(new GetObjectCommand({ Bucket, Key }));
  const chunks = [];
  for await (const chunk of res.Body) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf-8");
}

/**
 * List objects in the "data" bucket under a prefix.
 */
export async function listDataObjects(Prefix) {
  const Bucket = process.env.SHARPSIGNAL_DATA_BUCKET || "sharpsignal-ml-data";
  const res = await s3.send(
    new ListObjectsV2Command({
      Bucket,
      Prefix,
      // Optional: limit results (S3 returns up to 1000 anyway)
      MaxKeys: 1000,
    })
  );
  return res.Contents || [];
}

import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Proxies the FastAPI stream so the browser can fetch /api/stream from Next.js.
 * Make sure your FastAPI stream server is running on 8101.
 */
const STREAM_BASE = process.env.STREAM_BASE || "http://localhost:8101";

export const config = { api: { bodyParser: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const prompt = (req.query.prompt as string) ?? "";
  const upstream = await fetch(`${STREAM_BASE}/api/stream?prompt=${encodeURIComponent(prompt)}`);

  if (!upstream.body) {
    res.status(502).end("No stream from backend");
    return;
  }

  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });

  // Pipe the ReadableStream to the client
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    res.write(decoder.decode(value));
  }
  res.end();
}

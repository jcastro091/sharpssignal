import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  return res.status(410).json({ ok: false, error: "public_signal_assistant_retired" });
}

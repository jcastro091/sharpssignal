// pages/api/chat.ts
import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ type: "error", detail: "Use POST { q | message }" });
    return;
  }
  const q = String((req.body?.q ?? req.body?.message ?? "")).trim();
  if (!q) {
    res.status(400).json({ type: "error", detail: "Missing q/message" });
    return;
  }
  res.json({ type: "faq", answer: "Try: 'best odds for yankees moneyline' or 'explain yesterday’s pick'." });
}

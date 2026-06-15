import type { NextApiRequest, NextApiResponse } from "next";
import { loadTrustHealth } from "../../lib/publicGrowth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const windowDays = Number(req.query.days || 14);
    const health = await loadTrustHealth(Number.isFinite(windowDays) && windowDays > 0 ? windowDays : 14);
    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=600");
    return res.status(200).json({ ok: true, health });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message || "Failed to load trust health" });
  }
}

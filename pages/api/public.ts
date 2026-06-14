import type { NextApiRequest, NextApiResponse } from "next";
import { buildPublicApiPayload } from "../../lib/publicGrowth";

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
    const payload = await buildPublicApiPayload();
    return res.status(200).json(payload);
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message || "Failed to build public API payload" });
  }
}

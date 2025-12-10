import type { NextApiRequest, NextApiResponse } from "next";
// If you have a lightweight graph query helper, import it here.
export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    // Run the tiniest possible query to warm caches / verify connectivity
    // e.g., await graphs.minProbe()
    res.status(200).json({ ok: true, probe: "graphs:min", ts: new Date().toISOString() });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e) });
  }
}

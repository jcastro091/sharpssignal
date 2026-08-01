import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
  return res.status(200).json({
    ok: true,
    product: "SharpsSignal",
    engines: ["sports", "markets"],
    evidence_status: "research_and_paper_validation",
    verification: "private",
    public_disclosure: "aggregate_attestation_only",
    profitability_claim: false,
  });
}

// pages/api/truai/verify.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { findRecord } from "../../../lib/truai/registry";

function canonicalize(d: string) {
  return d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const domainParam = typeof req.query.domain === "string" ? req.query.domain : undefined;
  const domain = domainParam ? canonicalize(domainParam) : "sharps-signal.com";

  const record = findRecord(domain);

  if (!record) {
    return res.status(404).json({
      valid: false,
      domain,
      error: "No certification record found for domain",
      how_to_fix: "Submit the domain to TruAI Guard to generate a certification record."
    });
  }

  // Minimal response format designed for public verification
  return res.status(200).json({
    valid: record.badge !== "Not Certified",
    domain: record.domain,
    product: record.product,
    badge: record.badge,
    risk_score: record.risk_score,
    issued_at_utc: record.issued_at_utc,
    checks_run: record.checks_run,
    report_hash_sha256: record.report_hash_sha256,
    artifact_url: record.artifact_url,
    badge_svg_url: record.badge_svg_url,
    notes: record.notes ?? []
  });
}

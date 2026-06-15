import type { NextApiRequest, NextApiResponse } from "next";
import { loadAuditedRecord, siteBaseUrl } from "../../lib/publicGrowth";

function pct(value: number | null | undefined) {
  if (value == null) return "n/a";
  return `${(value * 100).toFixed(1)}%`;
}

function money(value: number | null | undefined) {
  if (value == null) return "n/a";
  return `$${Number(value).toFixed(2)}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const record = await loadAuditedRecord();
    const latest = record.weekly_reports[0] || null;
    const url = `${siteBaseUrl()}/reports/weekly`;
    const text = latest
      ? [
          `SharpSignal weekly audited report (${latest.week_start} to ${latest.week_end})`,
          `Closed: ${latest.closed} | Record: ${latest.wins}-${latest.losses}-${latest.pushes}`,
          `ROI: ${pct(latest.roi)} | P&L: ${money(latest.pnl)} | Avg CLV: ${pct(latest.avg_clv_pct)}`,
          `Official closed bets only: ${url}`,
        ].join("\n")
      : [
          "SharpSignal weekly audited report",
          "No public audited sample yet. We are still collecting official closed bets with closing-line data.",
          `Record page: ${siteBaseUrl()}/record`,
        ].join("\n");

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
    if (req.query.format === "text") {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.status(200).send(text);
    }
    return res.status(200).json({
      ok: true,
      generated_at: record.generated_at,
      url,
      latest,
      text,
      sample_status: record.sample_status,
    });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message || "Failed to build weekly report" });
  }
}

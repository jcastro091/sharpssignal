import type { NextApiRequest, NextApiResponse } from "next";

const SPORTS_API_BASE = (
  process.env.SHARPS_SIGNAL_SPORTS_API_URL ||
  "https://sharpssignal-sports-api.vercel.app"
).replace(/\/$/, "");

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
    const upstreamUrl = new URL("/api/picks-preview", SPORTS_API_BASE);
    for (const [key, value] of Object.entries(req.query || {})) {
      if (Array.isArray(value)) value.forEach((item) => upstreamUrl.searchParams.append(key, item));
      else if (value !== undefined) upstreamUrl.searchParams.set(key, value);
    }

    const upstream = await fetch(upstreamUrl, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    const payload = await upstream.json();
    if (!upstream.ok || !payload?.ok) {
      return res.status(upstream.status || 502).json({
        ok: false,
        error: payload?.error || `sports_api_${upstream.status}`,
      });
    }

    const counts = payload.counts || {};
    const summary = payload.research_summary || {};
    const lane = payload.mlb_h2h_underdog_probation || {};
    const cleanClosed = nullableNumber(
      payload.profitability_milestones?.betting_profitability_margin?.clean_closed
    );

    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).json({
      ok: true,
      source: "v3_sports_api",
      key: payload.key || "supabase_public_preview",
      today: payload.day,
      modelRunTimeISO: payload.generated_at,
      statsLast7: {
        winRatePct: null,
        roiPct: nullableNumber(
          payload.profitability_milestones?.betting_profitability_margin?.roi
        ),
        totalBets: cleanClosed || 0,
      },
      todayPicks: [],
      counts: {
        todayPicks: Number(counts.todayPicks || 0),
        todayDateTimeRows: Number(counts.todayDateTimeRows || 0),
        officialPicksToday: Number(counts.officialPicksToday || 0),
        shadowRowsToday: Number(counts.shadowRowsToday || 0),
        shadowGroupsToday: Number(counts.shadowGroupsToday || 0),
        laneDecisions: Number(counts.laneDecisions || 0),
      },
      status: payload.status || {},
      researchSummary: {
        officialPicksToday: Number(summary.official_picks_today || 0),
        shadowCandidatesToday: Number(summary.shadow_candidates_today || 0),
        message: summary.message || "No official pick is public right now.",
      },
      mlbH2hUnderdogProbation: lane,
      hasSelectedLane: Number(counts.laneDecisions || 0) > 0,
      evidenceCohort: payload.evidence_cohort || {},
      profitabilityMilestones: payload.profitability_milestones || {},
    });
  } catch (error: any) {
    console.error("[/api/picks-preview] v3 proxy error:", error?.message || error);
    return res.status(502).json({ ok: false, error: "sports_api_unavailable" });
  }
}

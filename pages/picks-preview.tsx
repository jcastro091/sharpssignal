// pages/picks-preview.tsx
import Link from "next/link";
import { useEffect } from "react";
import { gaEvent } from "../lib/ga";
import { trackFunnelEvent } from "../lib/funnelClient";

type PreviewPick = {
  matchup: string;
  sport: string;
  market: string;
  pick: string;
  tier: string;
  minutesToStart: number | null;
  timestampRaw: string;
  timestampISO: string | null;
  americanOdds: number | null;
};

type MlbProbation = {
  status?: string;
  bet_action?: string;
  reasons?: string[];
  data_confidence?: string;
  betting_readiness?: string;
  closed?: number;
  record?: string;
  roi?: number | null;
  avg_clv_pct?: number | null;
  clv_coverage?: number | null;
  current_best_retail_book?: string;
  minimum_bettable_odds?: string;
  latest_result?: string;
  latest_clv_pct?: number | null;
  latest_game?: string;
  latest_pick?: string;
  latest_game_time?: string;
};

type PreviewStatus = {
  betting_readiness?: string;
  official_pick_status?: string;
  research_status?: string;
};

type ResearchSummary = {
  officialPicksToday?: number;
  shadowCandidatesToday?: number;
  message?: string;
};

function fmtTs(raw: string) {
  if (!raw) return "—";
  return raw; // keep raw as shown in your CSV (simple + transparent)
}

type Props =
  | {
      ok: true;
      today: string;
      modelRunTimeISO: string | null;
      statsLast7: { winRatePct: number; roiPct: number; totalBets: number };
      todayPicks: PreviewPick[];
      counts?: {
        todayPicks?: number;
        todayDateTimeRows?: number;
        shadowRowsToday?: number;
        shadowGroupsToday?: number;
      };
      status?: PreviewStatus;
      researchSummary?: ResearchSummary;
      mlbH2hUnderdogProbation?: MlbProbation;
      qs: string;
    }
  | { ok: false; error: string; qs: string };

function formatNY(iso: string | null) {
  if (!iso) return "Unknown";
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function tierBadge(tier: string) {
  const t = (tier || "").toUpperCase();
  if (t.includes("A")) return "✅ A (Pro)";
  if (t.includes("B")) return "🟡 B (Pro)";
  if (t.includes("C")) return "⚪️ C";
  return tier || "—";
}

function pct(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "n/a";
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function plainStatus(value: string | undefined) {
  return String(value || "SKIP").replace(/_/g, " ").toUpperCase();
}

// --- SOFT GATE SETTINGS ---
const FREE_VISIBLE_ROWS = 5;

function gatedClass(isGated: boolean) {
  return isGated ? "select-none blur-sm" : "";
}

export default function PicksPreviewPage(props: Props) {
  const qs = props.qs || "";
  const signupHref = `/signup${qs}`;

  useEffect(() => {
    const onScroll = () => {
      const ratio =
        (window.scrollY + window.innerHeight) /
        document.documentElement.scrollHeight;

      if (ratio >= 0.75) {
        gaEvent({
          action: "scroll_75",
          category: "picks_preview",
          label: "75_percent",
        });
        window.removeEventListener("scroll", onScroll);
      }
    };

    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!props.ok) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-3xl mx-auto bg-white border rounded-xl p-6 shadow">
          <h1 className="text-2xl font-bold mb-2">Picks Preview</h1>
          <p className="text-sm text-red-600">{props.error}</p>
          <div className="mt-4">
            <Link
              href={signupHref}
              onClick={() =>
                gaEvent({
                  action: "click_signup",
                  category: "picks_preview",
                  label: "top_cta",
                })
              }
              className="inline-flex items-center px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition"
            >
              Unlock full picks → Sign up free
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { today, modelRunTimeISO, statsLast7, todayPicks } = props;
  const summary = props.researchSummary || {};
  const previewStatus = props.status || {};
  const mlb = props.mlbH2hUnderdogProbation || {};
  const mlbReasons = Array.isArray(mlb.reasons) && mlb.reasons.length ? mlb.reasons : ["Waiting for clean sample, CLV coverage, no-conflict status, and fresh prices."];

  const total = todayPicks.length;
  const gatedCount = Math.max(0, total - FREE_VISIBLE_ROWS);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-3xl font-bold">Today’s Picks (Preview)</h1>
            <p className="text-sm text-gray-600 mt-1">
              Model last run:{" "}
              <span className="font-semibold">{formatNY(modelRunTimeISO)}</span>{" "}
              ET
            </p>
          </div>

          <Link
            href={signupHref}
            onClick={() =>
              gaEvent({
                action: "click_signup",
                category: "picks_preview",
                label: "header_cta",
              })
            }
            className="shrink-0 inline-flex items-center px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition"
          >
            Unlock full picks → Sign up free
          </Link>
        </div>

        {/* Proof cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white border rounded-xl p-5 shadow">
            <div className="text-xs text-gray-500">Last 7 days</div>
            <div className="text-2xl font-bold mt-1">{statsLast7.winRatePct}%</div>
            <div className="text-sm text-gray-600">Win rate</div>
          </div>
          <div className="bg-white border rounded-xl p-5 shadow">
            <div className="text-xs text-gray-500">Last 7 days</div>
            <div className="text-2xl font-bold mt-1">
              {statsLast7.roiPct >= 0 ? "+" : ""}
              {statsLast7.roiPct}%
            </div>
            <div className="text-sm text-gray-600">ROI</div>
          </div>
          <div className="bg-white border rounded-xl p-5 shadow">
            <div className="text-xs text-gray-500">Last 7 days</div>
            <div className="text-2xl font-bold mt-1">{statsLast7.totalBets}</div>
            <div className="text-sm text-gray-600">Graded picks</div>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-slate-950 bg-slate-950 p-5 text-white shadow">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold text-emerald-300">Most visitors start here</div>
              <h2 className="mt-1 text-2xl font-bold">Unlock the full picks table and track the record for free.</h2>
              <p className="mt-2 text-sm text-slate-300">
                You are not buying guaranteed picks; you are getting audited signal access, no-pick context,
                CLV coverage, and the watchlist lanes we are proving before promotion.
              </p>
            </div>
            <Link
              href={signupHref}
              onClick={() =>
                trackFunnelEvent("signup_click", {
                  location: "picks_preview_primary_panel",
                  label: "primary_panel_cta",
                })
              }
              className="inline-flex shrink-0 items-center justify-center rounded bg-emerald-400 px-5 py-3 font-semibold text-slate-950 hover:bg-emerald-300"
            >
              Sign up free
            </Link>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Today&apos;s research status</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-bold text-white">
                {plainStatus(previewStatus.betting_readiness)}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                {plainStatus(previewStatus.research_status)}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              {summary.message || "No official pick is public right now; watchlist research remains excluded from paid ROI."}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-xs text-slate-500">Official</div>
                <div className="font-bold">{summary.officialPicksToday ?? props.counts?.todayPicks ?? 0}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Shadow groups</div>
                <div className="font-bold">{summary.shadowCandidatesToday ?? props.counts?.shadowGroupsToday ?? 0}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Rows today</div>
                <div className="font-bold">{props.counts?.todayDateTimeRows ?? total}</div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">MLB H2H underdog probation</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                {plainStatus(mlb.bet_action)}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                {plainStatus(mlb.data_confidence || "low")} confidence
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              First beachhead: MLB H2H underdogs. This is a watchlist lane, not a profitability claim.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div><div className="text-xs text-slate-500">Closed</div><div className="font-bold">{mlb.closed ?? 0}</div></div>
              <div><div className="text-xs text-slate-500">Record</div><div className="font-bold">{mlb.record || "0-0-0"}</div></div>
              <div><div className="text-xs text-slate-500">Avg CLV</div><div className="font-bold">{pct(mlb.avg_clv_pct)}</div></div>
              <div><div className="text-xs text-slate-500">CLV coverage</div><div className="font-bold">{pct(mlb.clv_coverage)}</div></div>
            </div>
            {(mlb.current_best_retail_book || mlb.minimum_bettable_odds) && (
              <p className="mt-3 text-sm text-slate-700">
                Best retail: <strong>{mlb.current_best_retail_book || "n/a"}</strong>. Do not bet below{" "}
                <strong>{mlb.minimum_bettable_odds || "the listed minimum"}</strong>.
              </p>
            )}
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
              {mlbReasons.slice(0, 3).map((reason, index) => (
                <li key={`${reason}-${index}`}>{reason}</li>
              ))}
            </ul>
          </section>
        </div>

        {/* Picks */}
        <div className="bg-white border rounded-xl p-5 shadow">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-lg font-semibold">Picks for {today}</h2>
            <span className="text-xs text-gray-500">{total} shown</span>
          </div>

          {total === 0 ? (
            <p className="text-sm text-gray-600">
              No picks found for today in the latest dataset.
            </p>
          ) : (
            <div className="space-y-2">
              {todayPicks.map((p, i) => {
                const isGated = i >= FREE_VISIBLE_ROWS;

                return (
                  <div key={`${p.timestampRaw}-${p.market}-${p.matchup}-${i}`}>
                    {/* Insert the gate panel right after the last free row */}
                    {i === FREE_VISIBLE_ROWS && gatedCount > 0 && (
                      <div className="my-4 border rounded-xl p-4 bg-indigo-50">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-indigo-900">
                              Unlock {gatedCount} more picks for today
                            </div>
                            <div className="text-xs text-indigo-800 mt-1">
                              Create a free account to reveal full picks, odds, and tiers.
                            </div>
                          </div>
                          <Link
                            href={signupHref}
                            onClick={() =>
                              gaEvent({
                                action: "click_signup",
                                category: "picks_preview",
                                label: "mid_gate_cta",
                              })
                            }
                            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition"
                          >
                            Unlock now → Sign up free
                          </Link>
                        </div>
                      </div>
                    )}

                    <div
                      className={`grid grid-cols-1 sm:grid-cols-7 gap-2 border rounded-lg p-3 ${
                        isGated ? "opacity-90 pointer-events-none" : ""
                      }`}
                    >
                      <div className={`text-sm text-gray-700 ${gatedClass(isGated)}`}>
                        {p.sport || "—"}
                      </div>
                      <div className={`text-sm text-gray-700 ${gatedClass(isGated)}`}>
                        {p.market || "—"}
                      </div>

                      <div className={`text-xs text-gray-500 ${gatedClass(isGated)}`}>
                        {fmtTs(p.timestampRaw)}
                      </div>

                      <div className={`text-sm font-semibold ${gatedClass(isGated)}`}>
                        {p.pick || "—"}
                      </div>

                      <div className={`text-sm text-gray-700 ${gatedClass(isGated)}`}>
                        {p.matchup || "—"}
                      </div>

                      <div className={`text-sm text-gray-500 ${gatedClass(isGated)}`}>
                        {p.americanOdds ?? "odds"}
                      </div>

                      <div className={`text-sm ${gatedClass(isGated)}`}>
                        {tierBadge(p.tier)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Bottom CTA */}
          <div className="mt-5 flex justify-center">
            <Link
              href={signupHref}
              onClick={() =>
                gaEvent({
                  action: "click_signup",
                  category: "picks_preview",
                  label: "bottom_cta",
                })
              }
              className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition"
            >
              Unlock full picks → Sign up free
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export async function getServerSideProps({ req }: any) {
  // Preserve UTMs into signup
  const url = new URL(req.url, `http://${req.headers.host}`);
  const qs = url.search ? url.search : "";

  const proto =
    req.headers["x-forwarded-proto"] ||
    (req.headers.host?.startsWith("localhost") ? "http" : "https");
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const base = `${proto}://${host}`;

  try {
    const r = await fetch(`${base}/api/picks-preview`, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    const json = await r.json();

    if (!r.ok || !json?.ok) {
      return {
        props: { ok: false, error: json?.error || `HTTP ${r.status}`, qs },
      };
    }

    return { props: { ...json, qs } };
  } catch (e: any) {
    return {
      props: { ok: false, error: e?.message || "Failed to load preview", qs },
    };
  }
}

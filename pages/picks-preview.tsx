// pages/picks-preview.tsx
import Link from "next/link";
import { useEffect } from "react";
import { gaEvent } from "../lib/ga";

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

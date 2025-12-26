// pages/picks.js
import { useState, useEffect, useMemo } from "react";
import PicksTable from "../components/PicksTable.jsx";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// --- Tonight window helpers (ET) ---
const ET_TZ = "America/New_York";
const TONIGHT_START_HOUR = 17; // 5pm ET
const TONIGHT_END_HOUR = 2; // 2am ET (next day)

function getEtParts(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ET_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

// Decide if a datetime is "tonight" in ET.
// (Same-day >= 5pm OR next-day <= 2am)
function isTonightET(date) {
  if (!date) return false;
  const p = getEtParts(date);
  const hour = Number(p.hour);
  if (!Number.isFinite(hour)) return false;

  if (hour >= TONIGHT_START_HOUR) return true;
  if (hour <= TONIGHT_END_HOUR) return true;

  return false;
}

function formatEtTime(date) {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: ET_TZ,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function PicksPage({ initialPicks = [], initialTrades = [] }) {
  const picks = initialPicks;
  const trades = initialTrades;

  // Model metrics
  const [modelMetrics, setModelMetrics] = useState(null);
  const [metricsError, setMetricsError] = useState(null);

  // Global filters
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [sportFilter, setSportFilter] = useState("All");

  // Table filters (requested)
  const [q, setQ] = useState("");
  const [marketFilter, setMarketFilter] = useState("All");
  const [sideFilter, setSideFilter] = useState("All");
  const [resultFilter, setResultFilter] = useState("All");

  // UI state
  const [mounted, setMounted] = useState(false);
  const [bankroll, setBankroll] = useState(1000);
  const [kellyFraction, setKellyFraction] = useState(1);

  // ROI numbers (driven by dailyEval)
  const [mlRoi, setMlRoi] = useState({
    history: [],
    roiPercent: 0,
    winRate: 0,
    profit: 0,
    drawdown: 0,
  });

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    async function loadModelMetrics() {
      try {
        const res = await fetch("/api/model-metrics");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setModelMetrics(data);
      } catch (err) {
        console.error("[picks] failed to load model metrics", err);
        setMetricsError("Unable to load model metrics");
      }
    }
    loadModelMetrics();
  }, []);

  // Drive the ROI cards + bankroll curve from daily evaluation JSON
  useEffect(() => {
    if (!modelMetrics?.dailyEval) return;

    const evalDaily = modelMetrics.dailyEval;
    const roiPercent = (evalDaily.roi ?? 0) * 100;
    const winRate = (evalDaily.winRate ?? 0) * 100;

    const profit = bankroll * (evalDaily.roi ?? 0);
    const start = bankroll;
    const end = bankroll + profit;

    const history = [
      { date: 0, bankroll: start },
      { date: 1, bankroll: end },
    ];

    setMlRoi({
      history,
      roiPercent,
      winRate,
      profit,
      drawdown: 0,
    });
  }, [modelMetrics, bankroll]);

  const uniqueSports = useMemo(
    () => ["All", ...new Set((picks || []).map((p) => p.Sport || p.sport || "Unknown"))],
    [picks]
  );

  // helper: parse local-ish date, tolerate "ET/EDT"
  const ET_TOKENS = /\b(?:ET|EDT|EST|E[DS]T)\b/i;

  function toLocalDate(raw) {
    if (!raw) return null;
    if (raw instanceof Date) return isNaN(raw) ? null : raw;

    if (typeof raw === "number") {
      const base = new Date(Date.UTC(1899, 11, 30)); // Excel serial origin
      return new Date(base.getTime() + raw * 86400000);
    }

    let s = String(raw).trim();
    s = s.replace(ET_TOKENS, "UTC").trim();

    // "2025-08-13 13:01:29+00:00" -> "2025-08-13T13:01:29+00:00"
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\+\d{2}:\d{2}$/.test(s)) {
      s = s.replace(" ", "T");
    }

    const d = new Date(s);
    return isNaN(d) ? null : d;
  }

  function endOfDay(d) {
    if (!d) return null;
    const e = new Date(d);
    e.setHours(23, 59, 59, 999);
    return e;
  }

  function startOfDay(d) {
    if (!d) return null;
    const s = new Date(d);
    s.setHours(0, 0, 0, 0);
    return s;
  }

  // Apply date + sport filters first
  const filtered = useMemo(() => {
    const arr = Array.isArray(picks) ? picks : [];
    const sod = startOfDay(startDate);
    const eod = endOfDay(endDate);

    return arr.filter((pick) => {
      const rawTs =
        pick["Game Time"] ??
        pick.Timestamp ??
        pick["Commence Time"] ??
        pick.ts_iso ??
        pick.ts_local ??
        null;

      const dt = toLocalDate(rawTs);

      const sport = pick.Sport ?? pick.sport ?? "Unknown";
      const passSport = sportFilter === "All" || sport === sportFilter;

      if (!sod && !eod) return passSport;
      if (!dt) return false;

      const passStart = !sod || dt >= sod;
      const passEnd = !eod || dt <= eod;

      return passStart && passEnd && passSport;
    });
  }, [picks, startDate, endDate, sportFilter]);

  // Normalize the filtered list
  const normalized = useMemo(() => {
    return (Array.isArray(filtered) ? filtered : []).map((row) => {
      const rawTime =
        row.ts_iso ??
        row.ts_local ??
        row["Game Time"] ??
        row["Commence Time"] ??
        row.Timestamp ??
        null;

      const dt = toLocalDate(rawTime);

      // Odds
      const ODDS_KEYS = [
        "Odds (Am)",
        "American Odds",
        "american_odds",
        "LowVig Home Odds (Am)",
        "LowVig Away Odds (Am)",
        "BetOnline Home Odds (Am)",
        "BetOnline Away Odds (Am)",
      ];
      let oddsRaw = ODDS_KEYS.map((k) => row[k]).find((v) => v !== undefined && v !== null && v !== "");
      let oddsAm = Number(String(oddsRaw).replace(/[^0-9.-]/g, ""));
      if (!Number.isFinite(oddsAm)) {
        const dec = Number(
          String(
            row["Decimal Odds (Current)"] ??
              row.decimal_odds ??
              row["Current Decimal"] ??
              row["Peak Decimal"] ??
              row["Opening Decimal"] ??
              ""
          ).replace(/[^0-9.]/g, "")
        );
        if (Number.isFinite(dec) && dec > 1) {
          oddsAm = dec >= 2 ? Math.round((dec - 1) * 100) : Math.round(-100 / (dec - 1));
        } else {
          oddsAm = null;
        }
      }

      // Stake / Risk
      const STAKE_KEYS = ["Stake Amount", "Stake", "Risk", "Bet Size", "Kelly Stake", "stake_amount", "risk"];
      let stakeRaw = STAKE_KEYS.map((k) => row[k]).find((v) => v !== undefined && v !== null && v !== "");
      let stake = Number(String(stakeRaw).replace(/[^0-9.-]/g, ""));
      if (!Number.isFinite(stake)) stake = 1;

      // Predicted result if present
      const PRED_KEYS = ["Prediction Result", "Predicted Result (0/1)", "Predicted Result", "Prediction", "predicted_result", "pred"];
      let predRaw = PRED_KEYS.map((k) => row[k]).find((v) => v !== undefined && v !== null && v !== "");
      let pred = null;
      if (predRaw !== undefined && predRaw !== null && predRaw !== "") {
        const n = Number(String(predRaw).trim());
        if (Number.isFinite(n)) pred = n;
        else {
          const s = String(predRaw).trim().toLowerCase();
          if (s === "win" || s === "true") pred = 1;
          else if (s === "lose" || s === "false") pred = 0;
        }
      }

      const awayTeam = row["Away Team"] ?? row["Away"] ?? row.away ?? "";
      const homeTeam = row["Home Team"] ?? row["Home"] ?? row.home ?? "";
      const predictedSide = row["Predicted"] ?? row["Direction"] ?? row["ML Direction"] ?? "";

	  // --- Tier (match picks-preview behavior) ---
	  const tierRaw =
	    row.Tier ??
	    row["Tier"] ??
	    row["Tier Code"] ??
	    row["TierCode"] ??
	    row["tier"] ??
	    row["tier_code"] ??
	    row["Pick Tier"] ??
	    row["PickTier"] ??
	    row["Pro Tier"] ??
	    row["ProTier"] ??
	    null;

	  // normalize like "A (Pro)" -> "A"
	  const tierCode = tierRaw ? String(tierRaw).trim().split(" ")[0].replace(/[()]/g, "") : "";

	  return {
	    ...row,
	    ts: dt,
	    ["Game Time"]: dt ? dt.toISOString() : row["Game Time"] ?? row.Timestamp ?? "",
	    ["Odds (Am)"]: oddsAm,
	    Risk: stake,
	    Prediction: pred,

	    // table-friendly aliases
	    ["Away Team"]: awayTeam,
	    ["Home Team"]: homeTeam,
	    Predicted: predictedSide,

	    // ✅ Tier fields for table
	    Tier: tierCode || "-",           // e.g. A/B/C
	    ["Tier Label"]: tierRaw || "-",  // e.g. "A (Pro)" if present
	  };

    });
  }, [filtered]);

  // Options for table filters (AFTER normalized exists)
  const uniqueMarkets = useMemo(() => {
    const set = new Set((normalized || []).map((r) => r.Market).filter(Boolean));
    return ["All", ...Array.from(set)];
  }, [normalized]);

  // Tonight’s picks (sorted ASC by time so the night reads in order)
  const tonightPicks = useMemo(() => {
    const arr = Array.isArray(normalized) ? normalized : [];
    const t = arr.filter((row) => isTonightET(row.ts));
    t.sort((a, b) => (a.ts?.getTime() ?? 0) - (b.ts?.getTime() ?? 0));
    return t;
  }, [normalized]);

  // Apply table filters + sort DESC (newest first)
  const tableRows = useMemo(() => {
    const needle = q.trim().toLowerCase();

    const filteredRows = (normalized || []).filter((r) => {
      const away = String(r["Away Team"] || r.Away || "").toLowerCase();
      const home = String(r["Home Team"] || r.Home || "").toLowerCase();

      const passQ = !needle || away.includes(needle) || home.includes(needle);
      const passMarket = marketFilter === "All" || (r.Market || "") === marketFilter;

      const dir = String(r.Direction || r.Predicted || "").trim().toLowerCase();
      const passSide = sideFilter === "All" || dir === sideFilter.toLowerCase();

      // Try common result fields (this won’t break if empty)
      const rawRes = String(r.Winner ?? r["Prediction Result"] ?? r.Result ?? "").trim().toLowerCase();
      const passRes =
        resultFilter === "All" ||
        (resultFilter === "Win" && (rawRes === "win" || rawRes === "w" || rawRes === "1")) ||
        (resultFilter === "Lose" && (rawRes === "lose" || rawRes === "loss" || rawRes === "l" || rawRes === "0")) ||
        (resultFilter === "Push" && (rawRes === "push" || rawRes === "p" || rawRes === "2"));

      return passQ && passMarket && passSide && passRes;
    });

    // DESC by timestamp (today first)
    return filteredRows.sort((a, b) => (b.ts?.getTime() ?? 0) - (a.ts?.getTime() ?? 0));
  }, [normalized, q, marketFilter, sideFilter, resultFilter]);

  // Tier summaries (if present)
  let tierSummaries = [];
  if (modelMetrics?.tierConfig?.tiers && Array.isArray(modelMetrics.tierConfig.tiers)) {
    const byCode = {};
    for (const t of modelMetrics.tierConfig.tiers) {
      const code = t.code || t.label || "Tier";
      if (!byCode[code] || t.min_proba < byCode[code].min_proba) {
        byCode[code] = {
          code,
          label: t.label || code,
          min_proba: t.min_proba,
          max_proba: t.max_proba,
        };
      }
    }
    tierSummaries = Object.values(byCode).sort((a, b) => String(a.code).localeCompare(String(b.code)));
  }

  const { history: _hist, roiPercent, winRate, profit, drawdown } = mlRoi;
  const history = _hist && _hist.length > 0 ? _hist : [{ date: 0, bankroll }];

  return (
    <div className="bg-gray-50 text-gray-900 min-h-screen p-4 sm:p-8">
      <h1 className="text-3xl font-bold mb-6">All Observations & Trades</h1>

      {/* Global Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div>
          <label className="block text-sm font-medium mb-1">Start Date</label>
          <DatePicker
            selected={startDate}
            onChange={(date) => setStartDate(date)}
            className="w-full px-4 py-2 border rounded bg-white"
            placeholderText="Select start date"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">End Date</label>
          <DatePicker
            selected={endDate}
            onChange={(date) => setEndDate(date)}
            className="w-full px-4 py-2 border rounded bg-white"
            placeholderText="Select end date"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Sport</label>
          <select
            value={sportFilter}
            onChange={(e) => setSportFilter(e.target.value)}
            className="w-full px-4 py-2 border rounded bg-white"
          >
            {uniqueSports.map((sport, i) => (
              <option key={i} value={sport}>
                {sport}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Kelly / Bankroll */}
      <div className="bg-white p-6 rounded-xl shadow border mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-1">Bankroll ($)</label>
            <input
              type="number"
              className="w-full px-4 py-2 border rounded-lg bg-gray-50"
              value={bankroll}
              onChange={(e) => setBankroll(parseFloat(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Kelly Fraction (0–1)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="1"
              className="w-full px-4 py-2 border rounded-lg bg-gray-50"
              value={kellyFraction}
              onChange={(e) => setKellyFraction(parseFloat(e.target.value))}
            />
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 mb-10">
        <StatCard
          label="Expected ROI"
          value={`${roiPercent >= 0 ? "+" : ""}${roiPercent.toFixed(2)}%`}
          color={roiPercent >= 0 ? "text-green-500" : "text-red-500"}
        />
        <StatCard label="Expected Win Rate" value={`${winRate.toFixed(2)}%`} color="text-blue-500" />
        <StatCard label="Expected Profit" value={`$${profit.toLocaleString()}`} color="text-green-600" />
        <StatCard
          label="Max Drawdown (Exp.)"
          value={`-$${Math.max(0, drawdown).toLocaleString()}`}
          color="text-orange-500"
        />
      </div>

      {/* Tonight's Picks */}
      <div className="bg-white p-6 rounded-xl shadow border mb-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Tonight’s Picks</h3>
            <p className="text-xs text-gray-500 mt-1">Picks scheduled for tonight (5pm–2am ET).</p>
          </div>
          <div className="text-xs text-gray-500">{tonightPicks.length ? `${tonightPicks.length} picks` : "No picks yet"}</div>
        </div>

        {tonightPicks.length === 0 ? (
          <div className="text-sm text-gray-500">No picks in tonight’s window yet.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {tonightPicks.slice(0, 18).map((p, idx) => {
              const away = p["Away Team"] || p.Away || p.away || "Away";
              const home = p["Home Team"] || p.Home || p.home || "Home";
              const sport = p.Sport || p.sport || "Unknown";
              const market = p.Market || p.market || "-";
              const dir = p.Direction || p.Predicted || "";
              const timeLabel = p.ts ? formatEtTime(p.ts) : "";

              const movement = p.Movement ?? "";
              const odds = p["Odds (Am)"];
              const reason = p["Reason Text"];

              return (
                <div key={idx} className="border rounded-xl p-4 bg-gray-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-semibold">
                      {away} <span className="text-gray-400">at</span> {home}
                    </div>
                    <div className="text-xs text-gray-500 whitespace-nowrap">{timeLabel}</div>
                  </div>

                  <div className="mt-2 text-sm text-gray-700">
                    <div>
                      <span className="font-medium">Sport:</span> {sport}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      <div>
                        <span className="font-medium">Market:</span> {market}
                      </div>
                      {dir ? (
                        <div>
                          <span className="font-medium">Side:</span> {dir}
                        </div>
                      ) : null}
                      {movement ? (
                        <div>
                          <span className="font-medium">Move:</span> {movement}
                        </div>
                      ) : null}
                      {Number.isFinite(odds) ? (
                        <div>
                          <span className="font-medium">Odds:</span> {odds}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {reason ? (
                    <div className="mt-3 text-xs text-gray-600 leading-snug">
                      {String(reason).slice(0, 160)}
                      {String(reason).length > 160 ? "…" : ""}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Model Performance */}
      <div className="bg-white p-6 rounded-xl shadow border mb-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Model Performance (Prod)</h3>
            {metricsError && <p className="text-xs text-red-500 mt-1">{metricsError}</p>}
            {!modelMetrics && !metricsError && <p className="text-xs text-gray-400 mt-1">Loading model metrics…</p>}
          </div>
          {modelMetrics?.modelCard && (
            <div className="text-right text-xs text-gray-500">
              <div>
                Version: <span className="font-semibold">{modelMetrics.modelCard.version || "baseline_winloss"}</span>
              </div>
              {modelMetrics.modelCard.trained_at && <div>Trained: {modelMetrics.modelCard.trained_at}</div>}
              {typeof modelMetrics.modelCard.auc === "number" && <div>AUC: {modelMetrics.modelCard.auc.toFixed(3)}</div>}
            </div>
          )}
        </div>

        {tierSummaries.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 text-sm">
            {tierSummaries.map((t) => (
              <div key={t.code} className="bg-gray-50 border rounded-lg p-3">
                <div className="font-semibold mb-1">
                  {t.label} ({t.code})
                </div>
                <div>
                  Min Prob: <span className="font-mono">{t.min_proba != null ? t.min_proba.toFixed(2) : "-"}</span>
                </div>
                {t.max_proba != null && (
                  <div>
                    Max Prob: <span className="font-mono">{t.max_proba.toFixed(2)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {modelMetrics?.weeklyMetrics?.length > 0 && (
          <div className="h-64">
            <h4 className="text-sm font-medium mb-2">Weekly Accuracy (Eval)</h4>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={modelMetrics.weeklyMetrics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 10 }} minTickGap={12} />
                <YAxis tickFormatter={(v) => `${v.toFixed(0)}%`} width={50} />
                <Tooltip
                  formatter={(value, name) => {
                    if (name === "accuracy") return [`${value.toFixed(1)}%`, "Accuracy"];
                    if (name === "auc") return [value.toFixed(3), "AUC"];
                    if (name === "volume") return [value, "Volume"];
                    return [value, name];
                  }}
                  labelFormatter={(label) => `Week: ${label}`}
                />
                <Line type="monotone" dataKey="accuracy" stroke="#8884d8" strokeWidth={2} dot={{ r: 2 }} name="accuracy" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {modelMetrics && (!modelMetrics.weeklyMetrics || modelMetrics.weeklyMetrics.length === 0) && (
          <p className="text-xs text-gray-400">No weekly metrics available yet.</p>
        )}
      </div>

      {/* Expected Bankroll Curve */}
      <div className="bg-white p-4 rounded-xl shadow border mb-6">
        <h3 className="text-lg font-semibold mb-3">Expected Bankroll (ML)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={history}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" hide />
            <YAxis domain={["auto", "auto"]} />
            <Tooltip />
            <Line type="monotone" dataKey="bankroll" stroke="#8884d8" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Table Filters (only for picks view) */}
		<div className="bg-white p-4 rounded-xl shadow border mb-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Search team</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full px-3 py-2 border rounded bg-white"
                placeholder="e.g. Yankees"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Market</label>
              <select
                value={marketFilter}
                onChange={(e) => setMarketFilter(e.target.value)}
                className="w-full px-3 py-2 border rounded bg-white"
              >
                {uniqueMarkets.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Side</label>
              <select
                value={sideFilter}
                onChange={(e) => setSideFilter(e.target.value)}
                className="w-full px-3 py-2 border rounded bg-white"
              >
                <option value="All">All</option>
                <option value="Down">Down</option>
                <option value="Up">Up</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Result</label>
              <select
                value={resultFilter}
                onChange={(e) => setResultFilter(e.target.value)}
                className="w-full px-3 py-2 border rounded bg-white"
              >
                <option value="All">All</option>
                <option value="Win">Win</option>
                <option value="Lose">Lose</option>
                <option value="Push">Push</option>
              </select>
            </div>
          </div>
        </div>

      {/* Tables */}
	  {mounted && <PicksTable picks={tableRows} />}
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow border">
      <div className="text-sm text-gray-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

export async function getServerSideProps({ req }) {
  const proto = req.headers["x-forwarded-proto"] || (req.headers.host?.startsWith("localhost") ? "http" : "https");
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const base = `${proto}://${host}`;

  let picks = [];
  let trades = [];

  try {
    const url = `${base}/api/picks?source=observations`;
    console.log("[picks/ssr] URL:", url);
    const res = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store" });
    const text = await res.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("[picks/ssr] JSON parse error", e);
    }

    if (Array.isArray(data)) picks = data;
    else if (Array.isArray(data?.rows)) picks = data.rows;
    else if (Array.isArray(data?.data)) picks = data.data;
    else if (Array.isArray(data?.picks)) picks = data.picks;
  } catch (e) {
    console.error("[picks/ssr] fetch error:", e);
  }

  return { props: { initialPicks: picks, initialTrades: trades } };
}

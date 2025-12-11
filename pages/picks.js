// pages/picks.js
import { useState, useEffect, useMemo } from "react";
import { createPagesServerClient } from "@supabase/auth-helpers-nextjs";
import PicksTable from "../components/PicksTable.jsx";
import TradesTable from "../components/TradesTable";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// Compute bankroll curve + ROI from your S3 predictions CSV
function computeRoiFromPredictions(rows, startingBankroll, { kellyFraction = 1 } = {}) {
  let bankroll = startingBankroll;
  let peak = bankroll;
  let worstDrawdown = 0;

  let wins = 0;
  let losses = 0;

  const history = [];

  // Make sure we run in time order
  const sorted = [...rows].sort(
    (a, b) => (a.ts?.getTime() ?? 0) - (b.ts?.getTime() ?? 0)
  );

  for (const r of sorted) {
    const ts = r.ts;
    const odds = Number(r["Odds (Am)"]);
    let stake = Number(r.Risk);

    if (!ts || !Number.isFinite(odds)) continue;
    if (!Number.isFinite(stake) || stake <= 0) continue;

    // Apply Kelly fraction slider
    stake = stake * kellyFraction;
    if (stake <= 0) continue;

    // Use the S3 "Prediction Result" column for outcome
    const rawResult = r["Prediction Result"];
    if (rawResult === null || rawResult === undefined || rawResult === "") {
      continue;
    }

    const s = String(rawResult).trim().toLowerCase();
    let outcome = null; // 1 = win, 0 = loss, "push" = no PnL

    if (s === "1" || s === "win" || s === "won" || s === "w") {
      outcome = 1;
    } else if (s === "0" || s === "lose" || s === "loss" || s === "l") {
      outcome = 0;
    } else if (s === "p" || s === "push" || s === "2") {
      outcome = "push";
    } else {
      continue; // unknown code, skip
    }

    let pnl = 0;
    if (outcome === 1) {
      // American odds payout
      if (odds > 0) {
        // +150 → win 1.5 * stake
        pnl = stake * (odds / 100);
      } else {
        // -110 → win ~0.91 * stake
        pnl = stake * (100 / Math.abs(odds));
      }
      wins++;
    } else if (outcome === 0) {
      pnl = -stake;
      losses++;
    } else if (outcome === "push") {
      pnl = 0; // stake returned, bankroll unchanged
    }

    bankroll += pnl;

    if (bankroll > peak) peak = bankroll;
    const dd = peak - bankroll;
    if (dd > worstDrawdown) worstDrawdown = dd;

    history.push({
      date: ts.toISOString(),
      bankroll,
    });
  }

  const n = wins + losses;
  const profit = bankroll - startingBankroll;
  const roiPercent = n > 0 ? (profit / startingBankroll) * 100 : 0;
  const winRate = n > 0 ? (wins / n) * 100 : 0;

  return {
    history,
    roiPercent,
    winRate,
    profit,
    drawdown: worstDrawdown,
  };
}


export default function PicksPage({ initialPicks = [], initialTrades = [] }) {
  const picks = initialPicks;
  const trades = initialTrades;	
  console.log("[picks/page] got picks:", picks.length, "trades:", trades.length)
  
  // inside PicksPage component, near other useState hooks
  const [modelMetrics, setModelMetrics] = useState(null);
  const [metricsError, setMetricsError] = useState(null);
  
  
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


	
  // DEBUG COUNTS (shows on the page)
  const rawCount = Array.isArray(picks) ? picks.length : 0;
  const [mounted, setMounted] = useState(false);
  const [bankroll, setBankroll] = useState(1000);
  const [kellyFraction, setKellyFraction] = useState(1);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [sportFilter, setSportFilter] = useState("All");
  const [viewMode, setViewMode] = useState("picks");
  const [mlRoi, setMlRoi] = useState({ history: [], roiPercent: 0, winRate: 0, profit: 0, drawdown: 0 });


  // Drive the ROI cards + bankroll curve from daily evaluation JSON
  useEffect(() => {
    if (!modelMetrics?.dailyEval) return;

    const evalDaily = modelMetrics.dailyEval;

    const roiPercent = (evalDaily.roi ?? 0) * 100;
    const winRate = (evalDaily.winRate ?? 0) * 100;

    // Scale expected profit to the current bankroll input
    // (evaluation.roi is profit / total_staked; here we treat it as edge on bankroll)
    const profit = bankroll * (evalDaily.roi ?? 0);

    // Simple 2-point bankroll curve: start → end
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
      drawdown: 0,  // we don't have DD in evaluation yet
    });
  }, [modelMetrics, bankroll]);


  useEffect(() => setMounted(true), []);

  const uniqueSports = useMemo(
	  () => ["All", ...new Set((picks || []).map(p => p.Sport || p.sport || "Unknown"))],
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
    // strip ET/EST/EDT etc and normalize to UTC
    s = s.replace(ET_TOKENS, "UTC").trim();

    // Handle "2025-08-13 13:01:29+00:00" → "2025-08-13T13:01:29+00:00"
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\+\d{2}:\d{2}$/.test(s)) {
      s = s.replace(" ", "T");
    }

    const d = new Date(s);
    return isNaN(d) ? null : d;
  }



  // make endDate inclusive (end of day)
  function endOfDay(d) {
    if (!d) return null;
    const e = new Date(d);
    e.setHours(23, 59, 59, 999);
    return e;
  }
  
  function startOfDay(d){ if(!d) return null; const s=new Date(d); s.setHours(0,0,0,0); return s; }

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

      // If NO date filter is set, don't drop rows just because we
      // couldn't parse the timestamp – still show them.
      if (!sod && !eod) {
        return passSport;
      }

      // If there IS a date filter and dt is invalid, drop the row.
      if (!dt) return false;

      const passStart = !sod || dt >= sod;
      const passEnd = !eod || dt <= eod;

      return passStart && passEnd && passSport;
    });
  }, [picks, startDate, endDate, sportFilter]);



  // Normalize columns FROM THE FILTERED LIST
  // Normalize columns FROM THE FILTERED LIST
  const normalized = useMemo(() => {
    return (Array.isArray(filtered) ? filtered : []).map((row) => {
      // timestamp (prefer explicit ts fields)
      const rawTime =
        row.ts_iso ??
        row.ts_local ??
        row["Game Time"] ??
        row["Commence Time"] ??
        row.Timestamp ??
        null;

      const dt = toLocalDate(rawTime);

      // -------- Odds (American) --------
      const ODDS_KEYS = [
        "Odds (Am)",
        "American Odds",
        "american_odds",
        "LowVig Home Odds (Am)",
        "LowVig Away Odds (Am)",
        "BetOnline Home Odds (Am)",
        "BetOnline Away Odds (Am)",
      ];
      let oddsRaw = ODDS_KEYS.map((k) => row[k]).find(
        (v) => v !== undefined && v !== null && v !== ""
      );
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
          oddsAm =
            dec >= 2
              ? Math.round((dec - 1) * 100)
              : Math.round(-100 / (dec - 1));
        } else {
          oddsAm = null;
        }
      }

      // -------- Stake / Risk --------
      const STAKE_KEYS = [
        "Stake Amount",
        "Stake",
        "Risk",
        "Bet Size",
        "Kelly Stake",
        "stake_amount",
        "risk",
      ];
      let stakeRaw = STAKE_KEYS.map((k) => row[k]).find(
        (v) => v !== undefined && v !== null && v !== ""
      );
      let stake = Number(String(stakeRaw).replace(/[^0-9.-]/g, ""));
      if (!Number.isFinite(stake)) stake = 1; // default unit stake

      // -------- Predicted Result (0/1) --------
      const PRED_KEYS = [
        "Prediction Result", // if present
        "Predicted Result (0/1)",
        "Predicted Result",
        "Prediction",
        "predicted_result",
        "pred",
      ];
      let predRaw = PRED_KEYS.map((k) => row[k]).find(
        (v) => v !== undefined && v !== null && v !== ""
      );
      let pred = null;
      if (predRaw !== undefined && predRaw !== null && predRaw !== "") {
        const n = Number(String(predRaw).trim());
        if (Number.isFinite(n)) {
          pred = n;
        } else {
          const s = String(predRaw).trim().toLowerCase();
          if (s === "win" || s === "true") pred = 1;
          else if (s === "lose" || s === "false") pred = 0;
        }
      }

      // Optional: map into table-friendly aliases
      const awayTeam = row["Away Team"] ?? row["Away"] ?? row.away ?? "";
      const homeTeam = row["Home Team"] ?? row["Home"] ?? row.home ?? "";
      const predictedSide =
        row["Predicted"] ?? row["Direction"] ?? row["ML Direction"] ?? "";
      const oddsTaken =
        row["Odds Taken"] ??
        row["Odds (Am)"] ??
        row["American Odds"] ??
        "";
      const kellyPct =
        row["Kelly"] ?? row["Kelly %"] ?? row["Kelly Stake %"] ?? "";

      return {
        ...row,

        // internal / ROI fields
        ts: dt,
        ["Game Time"]:
          dt ? dt.toISOString() : row["Game Time"] ?? row.Timestamp ?? "",
        ["Odds (Am)"]: oddsAm,
        Risk: stake,
        Prediction: pred,

        // table aliases (so PicksTable sees real data instead of "-")
        ["Away Team"]: awayTeam,
        ["Home Team"]: homeTeam,
        Predicted: predictedSide,
        ["Odds Taken"]: oddsTaken,
        Kelly: kellyPct,
      };
    });
  }, [filtered]);



  // sort by time (use ts we added)
  const normSorted = useMemo(
    () => [...normalized].sort((a, b) => (a.ts?.getTime() ?? 0) - (b.ts?.getTime() ?? 0)),
    [normalized]
  );

  // Build ROI input — require ts + odds + stake + prediction (0/1)
  // Bets we can actually use for realized ROI (must have result + stake + odds)
/*   const betsForRoi = useMemo(() => {
    return normSorted.filter((r) => {
      const hasTs = !!r.ts;
      const hasOdds = Number.isFinite(r["Odds (Am)"]);
      const hasStake = Number.isFinite(r.Risk) && r.Risk > 0;
      const hasResult = r["Prediction Result"] !== null &&
        r["Prediction Result"] !== undefined &&
        String(r["Prediction Result"]).trim() !== "";

      return hasTs && hasOdds && hasStake && hasResult;
    });
  }, [normSorted]);
 */

  useEffect(() => {
    console.log("[picks] filtered length =", filtered.length);
    if (filtered[0]) {
      console.log("[picks] sample filtered row keys:", Object.keys(filtered[0]));
      console.log("[picks] filtered[0] Timestamp:", filtered[0].Timestamp);
    }
  }, [filtered]);

  useEffect(() => {
    console.log("[picks] normalized length =", normalized.length);
    if (normalized[0]) {
      console.log("[picks] sample normalized row:", {
        ts: normalized[0].ts,
        odds: normalized[0]["Odds (Am)"],
        risk: normalized[0].Risk,
        pred: normalized[0].Prediction,
      });
    }
  }, [normalized]);


  // Compute ROI from roiInput only
/*   useEffect(() => {
    const result = computeRoiFromPredictions(betsForRoi, bankroll, { kellyFraction });
    console.log("[picks] computeRoiFromPredictions result:", result);
    setMlRoi(result);
  }, [betsForRoi, bankroll, kellyFraction]);

  */


  const { history: _hist, roiPercent, winRate, profit, drawdown } = mlRoi;
  const history = (_hist && _hist.length > 0) ? _hist : [{ date: 0, bankroll }];

  // Build tier summaries from tier_config.json (group by code A/B/C)
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
    tierSummaries = Object.values(byCode).sort((a, b) =>
      String(a.code).localeCompare(String(b.code))
    );
  }


  return (
    <div className="bg-gray-50 text-gray-900 min-h-screen p-4 sm:p-8">
      <h1 className="text-3xl font-bold mb-6">All Observations & Trades</h1>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div>
          <label className="block text-sm font-medium mb-1">Start Date</label>
          <DatePicker
            selected={startDate}
            onChange={date => setStartDate(date)}
            className="w-full px-4 py-2 border rounded bg-white"
            placeholderText="Select start date"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">End Date</label>
          <DatePicker
            selected={endDate}
            onChange={date => setEndDate(date)}
            className="w-full px-4 py-2 border rounded bg-white"
            placeholderText="Select end date"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Sport</label>
          <select
            value={sportFilter}
            onChange={e => setSportFilter(e.target.value)}
            className="w-full px-4 py-2 border rounded bg-white"
          >
            {uniqueSports.map((sport, i) => (
              <option key={i} value={sport}>{sport}</option>
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
              onChange={e => setBankroll(parseFloat(e.target.value))}
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
              onChange={e => setKellyFraction(parseFloat(e.target.value))}
            />
          </div>
        </div>
      </div>

      {/* Stat Cards (ML-expected) */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 mb-10">
        <StatCard label="Expected ROI" value={`${roiPercent >= 0 ? "+" : ""}${roiPercent.toFixed(2)}%`} color={roiPercent >= 0 ? "text-green-500" : "text-red-500"} />
        <StatCard label="Expected Win Rate" value={`${winRate.toFixed(2)}%`} color="text-blue-500" />
        <StatCard label="Expected Profit" value={`$${profit.toLocaleString()}`} color="text-green-600" />
        <StatCard label="Max Drawdown (Exp.)" value={`-$${Math.max(0, drawdown).toLocaleString()}`} color="text-orange-500" />
      </div>
	  
	  {/* Model Performance & Weekly ROI (from S3) */}
	  <div className="bg-white p-6 rounded-xl shadow border mb-10">
	    <div className="flex items-center justify-between mb-4">
		  <div>
		    <h3 className="text-lg font-semibold">Model Performance (Prod)</h3>
		    {metricsError && (
			  <p className="text-xs text-red-500 mt-1">{metricsError}</p>
		    )}
		    {!modelMetrics && !metricsError && (
			  <p className="text-xs text-gray-400 mt-1">Loading model metrics…</p>
		    )}
		  </div>
		  {modelMetrics?.modelCard && (
		    <div className="text-right text-xs text-gray-500">
			  <div>Version: <span className="font-semibold">
			    {modelMetrics.modelCard.version || "baseline_winloss"}
			  </span></div>
			  {modelMetrics.modelCard.trained_at && (
			    <div>Trained: {modelMetrics.modelCard.trained_at}</div>
			  )}
			  {typeof modelMetrics.modelCard.auc === "number" && (
			    <div>AUC: {modelMetrics.modelCard.auc.toFixed(3)}</div>
			  )}
		    </div>
		  )}
	    </div>

		{tierSummaries.length > 0 && (
		  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 text-sm">
			{tierSummaries.map((t) => (
			  <div key={t.code} className="bg-gray-50 border rounded-lg p-3">
				<div className="font-semibold mb-1">{t.label} ({t.code})</div>
				<div>
				  Min Prob: <span className="font-mono">
					{t.min_proba != null ? t.min_proba.toFixed(2) : "-"}
				  </span>
				</div>
				{t.max_proba != null && (
				  <div>
					Max Prob: <span className="font-mono">
					  {t.max_proba.toFixed(2)}
					</span>
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
				<XAxis
				  dataKey="week"
				  tick={{ fontSize: 10 }}
				  minTickGap={12}
				/>
				<YAxis
				  tickFormatter={(v) => `${v.toFixed(0)}%`}
				  width={50}
				/>
				<Tooltip
				  formatter={(value, name) => {
					if (name === "accuracy") return [`${value.toFixed(1)}%`, "Accuracy"];
					if (name === "auc") return [value.toFixed(3), "AUC"];
					if (name === "volume") return [value, "Volume"];
					return [value, name];
				  }}
				  labelFormatter={(label) => `Week: ${label}`}
				/>
				<Line
				  type="monotone"
				  dataKey="accuracy"
				  stroke="#8884d8"
				  strokeWidth={2}
				  dot={{ r: 2 }}
				  name="accuracy"
				/>
			  </LineChart>
			</ResponsiveContainer>
		  </div>
	    )}

	    {modelMetrics && (!modelMetrics.weeklyMetrics || modelMetrics.weeklyMetrics.length === 0) && (
		  <p className="text-xs text-gray-400">No weekly metrics available yet.</p>
	    )}
	  </div>


      {/* Expected Bankroll Curve */}
      <div className="bg-white p-4 rounded-xl shadow border mb-10">
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

      <div className="flex space-x-2 mb-4">
        <button onClick={() => setViewMode("picks")} className={`px-4 py-2 rounded ${viewMode === "picks" ? "bg-blue-500 text-white" : "bg-gray-200"}`}>Observations</button>
        <button onClick={() => setViewMode("trades")} className={`px-4 py-2 rounded ${viewMode === "trades" ? "bg-blue-500 text-white" : "bg-gray-200"}`}>Trades</button>
      </div>

      {mounted && viewMode === "picks" && <PicksTable picks={normalized} />}
      {mounted && viewMode === "trades" && <TradesTable trades={trades} />}
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
  // Always use the request's host for SSR so dev uses localhost and prod uses the current domain.
  const proto = req.headers["x-forwarded-proto"] || (req.headers.host?.startsWith("localhost") ? "http" : "https");
  const host  = req.headers["x-forwarded-host"] || req.headers.host;
  const base  = `${proto}://${host}`;

  let picks = [];
  let trades = [];

  try {
    const url = `${base}/api/picks?source=observations`;
	console.log("[picks/ssr] URL:", url);
    const res = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store" });
    const text = await res.text();
    console.log("[picks/ssr] status:", res.status, "len(text):", text.length);
    let data;
    try { data = JSON.parse(text); } catch (e) { console.error("[picks/ssr] JSON parse error", e); }

    console.log("[picks/ssr] keys:", data && Object.keys(data));
    if (Array.isArray(data)) {
      picks = data;
    } else if (Array.isArray(data?.rows)) {
      picks = data.rows;
    } else if (Array.isArray(data?.data)) {
      picks = data.data;
    } else if (Array.isArray(data?.picks)) {
      picks = data.picks;
    }
    console.log("[picks/ssr] picks length FROM API:", picks.length);
    if (picks[0]) console.log("[picks/ssr] sample keys:", Object.keys(picks[0]).slice(0, 12));
  } catch (e) {
    console.error("[picks/ssr] fetch error:", e);
  }

  return { props: { initialPicks: picks, initialTrades: trades } };
}



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
import { computeRealizedRoi } from "../utils/realizedRoi";


export default function PicksPage({ initialPicks = [], initialTrades = [] }) {
  const picks = initialPicks;
  const trades = initialTrades;	
  console.log("[picks/page] got picks:", picks.length, "trades:", trades.length)
	
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

    const s = String(raw).replace(ET_TOKENS, "").trim().replace(/\s+/g, " ");
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

    return arr.filter(pick => {
      const rawTs = pick["Game Time"] ?? pick.Timestamp ?? pick["Commence Time"] ?? pick.ts_iso ?? pick.ts_local ?? null;
      const dt = toLocalDate(rawTs);
      const valid = !!dt;

      const passStart = !sod || !valid ? true : dt >= sod;   // <-- use sod
      const passEnd   = !eod || !valid ? true : dt <= eod;

      const sport = pick.Sport ?? pick.sport ?? "Unknown";
      const passSport = sportFilter === "All" || sport === sportFilter;

      return passStart && passEnd && passSport;
    });
  }, [picks, startDate, endDate, sportFilter]);


  // Normalize columns FROM THE FILTERED LIST
  const normalized = useMemo(() => {
    return (Array.isArray(filtered) ? filtered : []).map(row => {
      const gameTime =
        row.ts_iso ||
        row.ts_local ||
        row["Game Time"] ||
        row.Timestamp ||
        row["Commence Time"] || null;

      let oddsAm = row["Odds (Am)"] ?? row["American Odds"] ?? row.american_odds ?? "";
      if (typeof oddsAm === "string") oddsAm = Number(oddsAm.replace(/[^0-9.-]/g, ""));
      if (!Number.isFinite(oddsAm)) {
        const dec = Number(row["Decimal Odds (Current)"] ?? row.decimal_odds ?? "");
        if (Number.isFinite(dec) && dec > 1) {
          oddsAm = dec >= 2 ? Math.round((dec - 1) * 100) : Math.round(-100 / (dec - 1));
        }
      }

      let result = row.Result ?? row["Prediction Result"] ?? row.result ?? "";
      if (typeof result === "string") {
        const s = result.trim().toLowerCase();
        if (s === "win" || s === "1" || s === "true") result = 1;
        else if (s === "lose" || s === "0" || s === "false") result = 0;
      }
      result = Number(result);
      if (!Number.isFinite(result)) result = null;

      let stake = row["Stake Amount"] ?? row.Risk ?? row.risk ?? "";
      if (typeof stake === "string") stake = Number(stake.replace(/[^0-9.-]/g, ""));
      if (!Number.isFinite(stake)) stake = 1;

      return {
        ...row,
        Sport: row.Sport ?? row.sport ?? "Unknown",
        ["Game Time"]: gameTime,
        ["Odds (Am)"]: oddsAm,
        Result: result,
        Risk: stake,
      };
    });
  }, [filtered]);

  // Recompute the chart/metrics from the FILTERED data

  useEffect(() => {
    const result = computeRealizedRoi(normalized, bankroll, { kellyFraction });
    setMlRoi(result);
  }, [normalized, bankroll, kellyFraction]);
  


  const { history: _hist, roiPercent, winRate, profit, drawdown } = mlRoi;
  const history = (_hist && _hist.length > 0) ? _hist : [{ date: 0, bankroll }];

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



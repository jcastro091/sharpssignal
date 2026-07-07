// pages/picks.js
import { useState, useEffect, useMemo } from "react";
import PicksTable from "../components/PicksTable.jsx";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

import { gaEvent } from "../lib/ga";
import { appendAttributionToUrl, trackFunnelEvent } from "../lib/funnelClient";

// --- Tonight window helpers (ET) ---
const ET_TZ = "America/New_York";
const TONIGHT_START_HOUR = 17; // 5pm ET
const TONIGHT_END_HOUR = 2; // 2am ET (next day)
const ET_DAY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: ET_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const ET_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: ET_TZ,
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

function track(action, label, value) {
  gaEvent({ action, category: "picks", label, value });
}

function dateKeyInEastern(date) {
  return date ? ET_DAY_FORMATTER.format(date) : "";
}

function formatMetaTime(value) {
  if (!value) return "Not available";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "Not available";
  return ET_TIME_FORMATTER.format(dt);
}

function formatAge(hours) {
  if (!Number.isFinite(hours)) return "";
  if (hours < 1) return "<1h ago";
  if (hours < 48) return `${hours.toFixed(1)}h ago`;
  return `${(hours / 24).toFixed(1)}d ago`;
}

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

function etDateKeyOffset(parts, offsetDays) {
  const shifted = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + offsetDays));
  return shifted.toISOString().slice(0, 10);
}

function isCurrentTonightET(date, now = new Date()) {
  if (!date) return false;
  const rowParts = getEtParts(date);
  const nowParts = getEtParts(now);
  const rowHour = Number(rowParts.hour);
  const nowHour = Number(nowParts.hour);
  if (!Number.isFinite(rowHour) || !Number.isFinite(nowHour)) return false;

  const rowDay = `${rowParts.year}-${rowParts.month}-${rowParts.day}`;
  const today = `${nowParts.year}-${nowParts.month}-${nowParts.day}`;
  const yesterday = etDateKeyOffset(nowParts, -1);
  const tomorrow = etDateKeyOffset(nowParts, 1);

  if (nowHour >= TONIGHT_START_HOUR) {
    return (rowDay === today && rowHour >= TONIGHT_START_HOUR) || (rowDay === tomorrow && rowHour <= TONIGHT_END_HOUR);
  }
  if (nowHour <= TONIGHT_END_HOUR) {
    return (rowDay === yesterday && rowHour >= TONIGHT_START_HOUR) || (rowDay === today && rowHour <= TONIGHT_END_HOUR);
  }
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

function classifyResult(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (["win", "won", "w", "1", "true"].includes(raw)) return "Win";
  if (["loss", "lose", "lost", "l", "0", "false"].includes(raw)) return "Loss";
  if (["push", "p", "void", "refund"].includes(raw)) return "Push";
  return "";
}

function numericValue(value) {
  const n = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function formatMoney(value) {
  const n = numericValue(value);
  if (n == null) return "n/a";
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatPct(value) {
  const n = numericValue(value);
  if (n == null) return "n/a";
  return `${(n * 100).toFixed(1)}%`;
}

function clvValue(row) {
  return numericValue(row?.clv_pct ?? row?.["CLV %"] ?? row?.CLV ?? row?.clv);
}

function resultValue(row) {
  return classifyResult(row?.["Prediction Result"] ?? row?.Result ?? row?.Winner ?? row?.result);
}

function isClvGraded(row) {
  return Boolean(resultValue(row)) && clvValue(row) != null;
}

function TelegramUpsellCTA() {
  const checkoutUrl = appendAttributionToUrl(process.env.NEXT_PUBLIC_CHECKOUT_URL_STARTER || "/signup", {
    plan: "pro_telegram",
    next: "/picks",
  });

  const [telegramUrl, setTelegramUrl] = useState(null);
  const [unlockError, setUnlockError] = useState(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    const session_id = params.get("session_id");

    if (checkout === "success" && session_id) {
      setVerifying(true);

      (async () => {
        try {
          const r = await fetch(
            `/api/stripe/verify-success?session_id=${encodeURIComponent(session_id)}`
          );
          const j = await r.json();

          if (j.ok && j.telegramUrl) {
            setTelegramUrl(j.telegramUrl);

            // Optional: clean up the URL so the success params don't stick around
            // (prevents re-verifying on refresh + makes the URL pretty)
            try {
              const url = new URL(window.location.href);
              url.searchParams.delete("checkout");
              url.searchParams.delete("session_id");
              window.history.replaceState({}, "", url.toString());
            } catch {}
          } else {
            setUnlockError(j?.error || "Payment not verified yet.");
          }
        } catch {
          setUnlockError("Could not verify payment.");
        } finally {
          setVerifying(false);
        }
      })();
    }
  }, []);

  // ✅ PAID state: show ONLY the Join Telegram CTA (no upgrade pitch)
  if (telegramUrl) {
    return (
      <div className="bg-white rounded-2xl shadow border p-5 sm:p-6 mb-6 flex items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50">
            Realtime Plays
          </div>
          <h2 className="text-lg sm:text-xl font-bold mt-3">
            You’re in. Join the Telegram to get realtime alerts.
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Instant alerts when the edge appears (movement + limits).
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <a
            href={telegramUrl}
            target="_blank"
            rel="noreferrer"
            className="px-5 py-3 rounded-xl font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition"
            onClick={() => {
              track("join_telegram_clicked", "paid_state");
              trackFunnelEvent("telegram_join_click", { location: "paid_state" });
            }}
          >
            Join Telegram
          </a>
        </div>
      </div>
    );
  }

  // ⛔ Default/unpaid state: show original upsell card + greyed Join
  return (
    <div className="bg-white rounded-2xl shadow border p-5 sm:p-6 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50">
            Realtime Plays
          </div>

          <h2 className="text-lg sm:text-xl font-bold mt-3">
            Want picks the moment they trigger?
          </h2>

          <p className="text-sm text-gray-600 mt-1">
            Get realtime Telegram alerts when the edge appears (movement + limits).
            <span className="font-semibold"> $20/mo.</span> Cancel anytime.
          </p>

          <div className="flex flex-wrap gap-2 mt-3">
            <span className="inline-flex items-center gap-2 text-xs text-gray-700 bg-gray-50 border rounded-full px-3 py-1">
              ✅ Instant alerts
            </span>
            <span className="inline-flex items-center gap-2 text-xs text-gray-700 bg-gray-50 border rounded-full px-3 py-1">
              ✅ No spam
            </span>
            <span className="inline-flex items-center gap-2 text-xs text-gray-700 bg-gray-50 border rounded-full px-3 py-1">
              ✅ Full dashboard
            </span>
          </div>

          <div className="text-xs text-gray-500 mt-3">
            Tip: Keep a consistent unit size. Don’t chase.
          </div>

          {verifying && (
            <div className="text-xs text-indigo-600 mt-2">
              Verifying payment…
            </div>
          )}

          {unlockError && !verifying && (
            <div className="text-xs text-red-600 mt-2">
              {unlockError}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 sm:justify-end">
          <a
            href={checkoutUrl}
            className="px-5 py-3 rounded-xl font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition"
            onClick={() => {
              track("upgrade_clicked", "cta");
              trackFunnelEvent("checkout_click", { location: "picks_upsell", plan: "pro_telegram" });
            }}
          >
            Upgrade ($20/mo)
          </a>

          <button
            disabled
            title={verifying ? "Verifying payment…" : "Upgrade to unlock"}
            className="px-5 py-3 rounded-xl font-semibold border bg-white text-gray-400 cursor-not-allowed"
          >
            Join Telegram
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PicksPage({ initialPicks = [], initialTrades = [], initialFreshness = null }) {
  const picks = initialPicks;
  const trades = initialTrades;
  const freshness = initialFreshness || {};
  const rawCount = Array.isArray(picks) ? picks.length : 0;

  // Model metrics
  const [modelMetrics, setModelMetrics] = useState(null);
  const [metricsError, setMetricsError] = useState(null);
  const [memberDashboard, setMemberDashboard] = useState(null);

  // Global filters
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [sportFilter, setSportFilter] = useState("All");

  // Table filters
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

  // GA: page view event
  useEffect(() => {
    track("picks_viewed", "page_load");
  }, []);

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

  useEffect(() => {
    async function loadMemberDashboard() {
      try {
        const res = await fetch("/api/member-dashboard");
        const data = await res.json();
        setMemberDashboard(data);
      } catch (err) {
        console.error("[picks] failed to load member dashboard", err);
      }
    }
    loadMemberDashboard();
  }, []);

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

  function generatedDateKey(row) {
    const raw = row?.Timestamp ?? row?.timestamp ?? row?.observed_at ?? row?.created_at ?? null;
    if (!raw) return "";

    const s = String(raw).trim();
    if (/^\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}(?::\d{2})?)?$/.test(s)) {
      return s.slice(0, 10);
    }

    const dt = toLocalDate(raw);
    return dt ? dateKeyInEastern(dt) : "";
  }

  const hasDateFilter = Boolean(startDate || endDate);

  const generatedTodayPicks = useMemo(() => {
    const arr = Array.isArray(picks) ? picks : [];
    return arr;
  }, [picks]);

  const filtered = useMemo(() => {
    const arr = Array.isArray(generatedTodayPicks) ? generatedTodayPicks : [];
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
  }, [generatedTodayPicks, startDate, endDate, sportFilter]);

  const displayRows = useMemo(() => filtered, [filtered]);

  const normalized = useMemo(() => {
    return (Array.isArray(displayRows) ? displayRows : []).map((row) => {
      const rawTime =
        row.ts_iso ??
        row.ts_local ??
        row["Game Time"] ??
        row["Commence Time"] ??
        row.Timestamp ??
        null;

      const dt = toLocalDate(rawTime);

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

      const STAKE_KEYS = ["Stake Amount", "Stake", "Risk", "Bet Size", "Kelly Stake", "stake_amount", "risk"];
      let stakeRaw = STAKE_KEYS.map((k) => row[k]).find((v) => v !== undefined && v !== null && v !== "");
      let stake = Number(String(stakeRaw).replace(/[^0-9.-]/g, ""));
      if (!Number.isFinite(stake)) stake = 1;

      const PRED_KEYS = [
        "Prediction Result",
        "prediction_result",
        "Predicted Result (0/1)",
        "Predicted Result",
        "Prediction",
        "result",
        "predicted_result",
        "pred",
      ];
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

      const tierCode = tierRaw ? String(tierRaw).trim().split(" ")[0].replace(/[()]/g, "") : "";

      return {
        ...row,
        ts: dt,
        ["Game Time"]: dt ? dt.toISOString() : row["Game Time"] ?? row.Timestamp ?? "",
        ["Odds (Am)"]: oddsAm,
        Risk: stake,
        Prediction: pred,
        ["Away Team"]: awayTeam,
        ["Home Team"]: homeTeam,
        Predicted: predictedSide,
        Tier: tierCode || "-",
        ["Tier Label"]: tierRaw || "-",
      };
    });
  }, [displayRows]);

  const clvGradedRows = useMemo(() => {
    const arr = Array.isArray(normalized) ? normalized : [];
    return arr.filter(isClvGraded);
  }, [normalized]);

  const uniqueMarkets = useMemo(() => {
    const set = new Set((clvGradedRows || []).map((r) => r.Market).filter(Boolean));
    return ["All", ...Array.from(set)];
  }, [clvGradedRows]);

  const tonightPicks = useMemo(() => {
    const arr = Array.isArray(normalized) ? normalized : [];
    const t = arr.filter((row) => isCurrentTonightET(row.ts));
    t.sort((a, b) => (a.ts?.getTime() ?? 0) - (b.ts?.getTime() ?? 0));
    return t;
  }, [normalized]);

  const tableRows = useMemo(() => {
    const needle = q.trim().toLowerCase();

    const filteredRows = (clvGradedRows || []).filter((r) => {
      const away = String(r["Away Team"] || r.Away || "").toLowerCase();
      const home = String(r["Home Team"] || r.Home || "").toLowerCase();
      const pick = String(r.Direction || r.Predicted || r.Selection || "").toLowerCase();

      const passQ = !needle || away.includes(needle) || home.includes(needle) || pick.includes(needle);
      const passMarket = marketFilter === "All" || (r.Market || "") === marketFilter;

      const dir = String(r.Direction || r.Predicted || "").trim().toLowerCase();
      const passSide = sideFilter === "All" || dir === sideFilter.toLowerCase();

      const rawRes = String(r.Winner ?? r["Prediction Result"] ?? r.Result ?? r.result ?? "").trim().toLowerCase();
      const passRes =
        resultFilter === "All" ||
        (resultFilter === "Win" && (rawRes === "win" || rawRes === "w" || rawRes === "1")) ||
        (resultFilter === "Lose" && (rawRes === "lose" || rawRes === "loss" || rawRes === "l" || rawRes === "0")) ||
        (resultFilter === "Push" && (rawRes === "push" || rawRes === "p" || rawRes === "2"));

      return passQ && passMarket && passSide && passRes;
    });

    return filteredRows.sort((a, b) => (b.ts?.getTime() ?? 0) - (a.ts?.getTime() ?? 0));
  }, [clvGradedRows, q, marketFilter, sideFilter, resultFilter]);

  const proofStats = useMemo(() => {
    const graded = Array.isArray(clvGradedRows) ? clvGradedRows : [];
    const wins = graded.filter((row) => resultValue(row) === "Win").length;
    const losses = graded.filter((row) => resultValue(row) === "Loss").length;
    const pushes = graded.filter((row) => resultValue(row) === "Push").length;
    const pnl = graded.reduce((sum, row) => {
      const direct = numericValue(row.PnL ?? row["P&L"] ?? row.pnl ?? row.Profit);
      if (direct != null) return sum + direct;
      const result = resultValue(row);
      const risk = numericValue(row.Risk ?? row.Stake ?? row["Stake Amount"]) ?? 1;
      const odds = numericValue(row["Odds (Am)"]);
      if (result === "Loss") return sum - risk;
      if (result === "Push" || odds == null) return sum;
      const profit = odds > 0 ? risk * (odds / 100) : risk * (100 / Math.abs(odds));
      return sum + profit;
    }, 0);
    const staked = graded.reduce((sum, row) => sum + (numericValue(row.Risk ?? row.Stake ?? row["Stake Amount"]) ?? 1), 0);
    return {
      graded: graded.length,
      wins,
      losses,
      pushes,
      pnl,
      roi: staked > 0 ? pnl / staked : null,
      withClv: graded.length,
    };
  }, [clvGradedRows]);

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
    <div className="bg-slate-50 text-slate-950 min-h-screen p-4 sm:p-8">
      <div className="mb-6 rounded-2xl border bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">SharpSignal dashboard</div>
            <h1 className="mt-2 text-3xl font-black tracking-normal sm:text-4xl">Picks history and live board</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Review CLV-graded historical picks by default, then narrow into a date range, sport, market, or result. Open picks are only shown in the current tonight window when they exist.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:min-w-[520px]">
            <ProofMetric label="Graded" value={proofStats.graded.toLocaleString()} />
            <ProofMetric label="Record" value={`${proofStats.wins}-${proofStats.losses}${proofStats.pushes ? `-${proofStats.pushes}` : ""}`} />
            <ProofMetric label="P&L" value={formatMoney(proofStats.pnl)} tone={proofStats.pnl >= 0 ? "good" : "bad"} />
            <ProofMetric label="ROI" value={formatPct(proofStats.roi)} tone={proofStats.roi >= 0 ? "good" : "bad"} />
          </div>
        </div>
      </div>
      <FreshnessBanner freshness={freshness} rowCount={rawCount} isHistoricalView={hasDateFilter} />

      <MemberDashboard data={memberDashboard} />

      {/* NEW: CTA */}
      <TelegramUpsellCTA />

      {/* Global Filters */}
      <div className="mb-6 rounded-2xl border bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-bold">Find historical confidence fast</h2>
          <p className="text-sm text-slate-500">Leave dates blank to see every available CLV-graded historical pick.</p>
        </div>
        <div className="text-xs font-semibold text-slate-500">{tableRows.length.toLocaleString()} CLV-graded rows shown</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <p className="text-xs text-gray-500 mt-1">Current ET tonight window only (5pm-2am). Historical night games are excluded.</p>
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

      {/* Table Filters */}
      <div className="bg-white p-4 rounded-xl shadow border mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Search team or pick</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full px-3 py-2 border rounded bg-white"
              placeholder="e.g. Yankees, Dodgers, under"
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

      <div className="mb-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
        <strong className="text-slate-900">Audit note:</strong> this table only shows rows with a settled result and CLV value. Open picks, ungraded picks, and historical rows missing closing-line data are excluded from the proof table.
      </div>

      {/* Table */}
      {mounted && <PicksTable picks={tableRows} />}
    </div>
  );
}

function MemberDashboard({ data }) {
  const alerts = data?.today_research_alerts || [];
  const books = data?.best_available_books || [];
  const tails = data?.tail_results || [];
  const lanes = data?.watchlist_lanes || [];
  const proofBlocks = data?.proof_blocks || [];
  const operator = data?.operator_card || {};
  const beachhead = data?.beachhead || {};
  const disclosure = data?.affiliate?.disclosure || "";

  return (
    <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-2 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-indigo-600">Member command center</div>
          <h2 className="mt-1 text-2xl font-black tracking-normal">Research alerts, best book, and your tails</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Watchlist lanes stay research-only until the segment clears sample, CLV, ROI, and conflict gates. Official paid picks remain blocked until that happens.
          </p>
        </div>
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
          {data?.official_pick_gate?.status || "watchlist_only"}
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        <div className={`rounded border p-4 ${operator.decision === "green" ? "border-emerald-200 bg-emerald-50" : operator.decision === "yellow" ? "border-amber-200 bg-amber-50" : "border-rose-200 bg-rose-50"}`}>
          <div className="text-xs font-bold uppercase tracking-wide text-slate-600">Should we bet today?</div>
          <div className="mt-2 text-xl font-black">{operator.decision_label || "Loading status"}</div>
          <div className="mt-2 text-xs leading-5 text-slate-700">
            Official {operator.official_picks_today ?? 0} | watchlist {operator.watchlist_candidates_today ?? 0} | conflicts {operator.conflicts ?? 0} | CLV gaps {operator.clv_gaps ?? 0}
          </div>
          <div className="mt-1 text-xs leading-5 text-slate-700">
            Games watched {operator.games_watched ?? 0} | API {operator.api_used ?? "-"} / {operator.api_cap ?? "-"}
          </div>
        </div>
        <div className="rounded border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-600">Beachhead lane</div>
          <div className="mt-2 text-xl font-black">{beachhead.label || "MLB H2H underdogs"}</div>
          <div className="mt-2 text-xs leading-5 text-slate-700">
            Status: <strong>{beachhead.status || beachhead.promotion_status || "watchlist_only"}</strong> | readiness <strong>{beachhead.betting_readiness || "red"}</strong> | confidence <strong>{beachhead.data_confidence || "low"}</strong>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-600">{beachhead.message || "Research only until sample, CLV, and conflict gates clear."}</p>
        </div>
        <div className="rounded border border-slate-200 bg-white p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-600">Account scope</div>
          <div className="mt-2 text-xl font-black">{data?.authenticated ? "Private ledger" : "Research preview"}</div>
          <p className="mt-2 text-xs leading-5 text-slate-600">
            {data?.authenticated ? `Showing tail bets only for ${data.user_email}.` : "Sign in to see personal tail bets and P&L."}
          </p>
        </div>
      </div>

      <div className="mt-5 rounded border border-slate-200 bg-slate-50 p-4">
        <h3 className="font-bold">Why subscribe now</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {proofBlocks.length ? proofBlocks.map((block) => (
            <div key={block.label} className="rounded border bg-white p-3">
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{block.label}</div>
              <div className="mt-1 text-lg font-black">{block.value}</div>
              <p className="mt-1 text-xs leading-5 text-slate-600">{block.detail}</p>
            </div>
          )) : (
            <div className="text-sm text-slate-500">Proof blocks are loading.</div>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <div className="rounded border border-slate-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-bold">Today’s Research Alerts</h3>
            <span className="text-xs font-semibold text-slate-500">{alerts.length} grouped</span>
          </div>
          <div className="mt-4 space-y-3">
            {alerts.length ? (
              alerts.slice(0, 5).map((alert) => (
                <div key={`${alert.id}-${alert.game_time}`} className="rounded border bg-slate-50 p-3">
                  <div className="text-sm font-semibold">{alert.away_team || "Away"} @ {alert.home_team || "Home"}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-600">
                    {alert.market || "Market"}: <strong>{alert.pick_side || "Watchlist"}</strong>
                    {alert.appearances ? ` | seen ${alert.appearances}x` : ""}
                  </div>
                  <div className="mt-2 text-xs text-slate-700">
                    Best: <strong>{alert.best_available_price || "-"}</strong> | Min: <strong>{alert.minimum_acceptable_price || "-"}</strong>
                  </div>
                  {alert.best_available_price && (
                    <div className="mt-1 text-xs font-semibold text-emerald-700">
                      Still bettable at {alert.best_available_price}; do not bet below {alert.minimum_acceptable_price || "the signal number"}.
                    </div>
                  )}
                  {alert.cta_url && (
                    <a href={alert.cta_url} className="mt-3 inline-flex rounded bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800">
                      Open best book
                    </a>
                  )}
                </div>
              ))
            ) : (
              <div className="rounded border border-dashed p-4 text-sm text-slate-500">No research alerts captured yet today.</div>
            )}
          </div>
        </div>

        <div className="rounded border border-slate-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-bold">Best Available Book</h3>
            <span className="text-xs font-semibold text-slate-500">{books.length} prices</span>
          </div>
          <div className="mt-4 space-y-3">
            {books.length ? (
              books.slice(0, 5).map((book, idx) => (
                <div key={`${book.game}-${idx}`} className="rounded border bg-slate-50 p-3">
                  <div className="text-sm font-semibold">{book.best_available_price || book.book || "-"}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-600">{book.game} | {book.market} | {book.pick_side}</div>
                  <div className="mt-1 text-xs text-slate-700">{book.do_not_bet_below || `Do not bet below ${book.minimum_acceptable_price || "the signal number"}.`}</div>
                  <div className="mt-1 text-xs font-semibold text-emerald-700">
                    Still bettable at {book.best_available_price || book.book}; do not bet below {book.minimum_acceptable_price || "the signal number"}.
                  </div>
                  {book.cta_url && (
                    <a href={book.cta_url} className="mt-3 inline-flex rounded border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100">
                      Open sportsbook
                    </a>
                  )}
                </div>
              ))
            ) : (
              <div className="rounded border border-dashed p-4 text-sm text-slate-500">No best-book opportunities currently available.</div>
            )}
          </div>
        </div>

        <div className="rounded border border-slate-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-bold">Personal Tail Results</h3>
            <a href="/bets" className="text-xs font-bold text-indigo-700 hover:text-indigo-900">{tails.length} logged | full ledger</a>
          </div>
          <div className="mt-4 space-y-3">
            {tails.length ? (
              tails.slice(0, 6).map((tail) => (
                <div key={tail.tail_bet_id} className="rounded border bg-slate-50 p-3">
                  <div className="text-sm font-semibold">{tail.away_team || "Away"} @ {tail.home_team || "Home"}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-600">
                    {tail.sportsbook} {tail.odds_american > 0 ? `+${tail.odds_american}` : tail.odds_american} | stake {formatMoney(tail.stake)}
                  </div>
                  <div className="mt-1 text-xs text-slate-700">
                    Status: <strong>{tail.status || "open"}</strong> | P&L: <strong>{formatMoney(tail.pnl)}</strong> | CLV: <strong>{formatPct(tail.clv_pct)}</strong>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded border border-dashed p-4 text-sm text-slate-500">No tailed bets logged yet. Reply to Telegram alerts like “I bet $20 DK +107”.</div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="font-bold">Watchlist Lanes</h3>
          <span className="text-xs text-slate-500">Promotion disabled until gates clear</span>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {lanes.length ? lanes.slice(0, 6).map((lane) => (
            <div key={`${lane.sport}-${lane.market}-${lane.signal_lane}`} className="rounded border bg-white p-3 text-sm">
              <div className="font-semibold">{lane.sport} / {lane.market}</div>
              <div className="mt-1 text-xs text-slate-600">{lane.signal_lane}</div>
              <div className="mt-2 text-xs text-slate-700">
                Shadow {lane.shadow_count} | closed {lane.closed} | ROI {formatPct(lane.roi)} | CLV {formatPct(lane.avg_clv_pct)}
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold uppercase">
                <span className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700">{lane.promotion_status}</span>
                <span className={`rounded border px-2 py-1 ${lane.betting_readiness === "green" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : lane.betting_readiness === "yellow" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
                  readiness {lane.betting_readiness || "red"}
                </span>
                <span className="rounded border border-slate-200 bg-white px-2 py-1 text-slate-700">confidence {lane.data_confidence || "low"}</span>
              </div>
              {lane.frozen && <div className="mt-2 text-xs font-semibold text-rose-700">Frozen: {lane.freeze_reason || "conflict detected"}</div>}
            </div>
          )) : <div className="text-sm text-slate-500">No watchlist lanes available yet.</div>}
        </div>
      </div>
      {disclosure && <p className="mt-4 text-xs leading-5 text-slate-500">{disclosure}</p>}
    </section>
  );
}

function ProofMetric({ label, value, tone }) {
  const toneClass =
    tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-rose-700" : "text-slate-950";
  return (
    <div className="rounded-xl border bg-slate-50 p-3">
      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-xl font-black ${toneClass}`}>{value}</div>
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

function FreshnessBanner({ freshness, rowCount, isHistoricalView }) {
  const isFresh = Boolean(freshness?.isFresh && Number(freshness?.todayPickCount || 0) > 0);
  const latestPickAge = formatAge(
    typeof freshness?.latestPickAgeHours === "number" ? freshness.latestPickAgeHours : NaN
  );
  const latestGradedAge = formatAge(
    typeof freshness?.latestGradedAgeHours === "number" ? freshness.latestGradedAgeHours : NaN
  );
  const title = isHistoricalView
    ? "Historical observations"
    : isFresh
      ? "Fresh picks are live"
      : "No fresh picks yet today";
  const tone = isFresh || isHistoricalView
    ? "border-emerald-200 bg-emerald-50 text-emerald-950"
    : "border-amber-200 bg-amber-50 text-amber-950";

  return (
    <div className={`mb-6 rounded-lg border p-4 ${tone}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="text-sm font-semibold">{title}</div>
        <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <StatusMetric label="Today" value={`${Number(freshness?.todayPickCount || 0)} picks`} />
          <StatusMetric
            label="Latest pick"
            value={`${formatMetaTime(freshness?.latestPickAtISO)}${latestPickAge ? ` (${latestPickAge})` : ""}`}
          />
          <StatusMetric
            label="Latest grade"
            value={`${formatMetaTime(freshness?.latestGradedAtISO)}${latestGradedAge ? ` (${latestGradedAge})` : ""}`}
          />
          <StatusMetric label="Sheet rows" value={String(rowCount || freshness?.totalRows || 0)} />
        </div>
      </div>
    </div>
  );
}

function StatusMetric({ label, value }) {
  return (
    <div className="min-w-0">
      <div className="font-medium opacity-70">{label}</div>
      <div className="truncate font-semibold">{value}</div>
    </div>
  );
}

export async function getServerSideProps({ req }) {
  const proto = req.headers["x-forwarded-proto"] || (req.headers.host?.startsWith("localhost") ? "http" : "https");
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const base = `${proto}://${host}`;

  let picks = [];
  let trades = [];
  let freshness = null;

  try {
    const url = `${base}/api/picks?source=observations`;
    console.log("[picks/ssr] URL:", url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeout);
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
    freshness = data?.meta || null;
  } catch (e) {
    console.error("[picks/ssr] fetch error:", e);
  }

  return { props: { initialPicks: picks, initialTrades: trades, initialFreshness: freshness } };
}

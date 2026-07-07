import { useEffect, useMemo, useState } from "react";
import { requireServerUser } from "../lib/authServer";

export async function getServerSideProps({ req, res }) {
  const auth = await requireServerUser(req, res);
  if (!auth.user) {
    return {
      redirect: {
        destination: auth.redirect || "/signin?next=%2Fbets",
        permanent: false,
      },
    };
  }
  return { props: { userEmail: auth.user.email || "" } };
}

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function pct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return `${(n * 100).toFixed(1)}%`;
}

function odds(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return n > 0 ? `+${n}` : `${n}`;
}

function dateLabel(value) {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(dt);
}

function statusTone(row) {
  const result = String(row.result || row.status || "").toLowerCase();
  if (result === "win") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (result === "loss") return "bg-rose-50 text-rose-700 border-rose-200";
  if (result === "push") return "bg-slate-50 text-slate-700 border-slate-200";
  return "bg-amber-50 text-amber-800 border-amber-200";
}

export default function BetsPage({ userEmail = "" }) {
  const [ledger, setLedger] = useState({ ok: false, summary: {}, bets: [] });
  const [telegramLink, setTelegramLink] = useState({ ok: false, loading: true });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch("/api/tail-bets?limit=150");
        const data = await response.json();
        if (active) setLedger(data);
      } catch (error) {
        if (active) setLedger({ ok: false, error: String(error), summary: {}, bets: [] });
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadTelegramLink() {
      try {
        const response = await fetch("/api/telegram-link-code");
        const data = await response.json();
        if (active) setTelegramLink({ ...data, loading: false });
      } catch (error) {
        if (active) setTelegramLink({ ok: false, error: String(error), loading: false });
      }
    }
    loadTelegramLink();
    return () => {
      active = false;
    };
  }, []);

  async function refreshTelegramCode() {
    setTelegramLink((current) => ({ ...current, loading: true }));
    try {
      const response = await fetch("/api/telegram-link-code", { method: "POST" });
      const data = await response.json();
      setTelegramLink({ ...data, loading: false });
    } catch (error) {
      setTelegramLink({ ok: false, error: String(error), loading: false });
    }
  }

  const bets = Array.isArray(ledger.bets) ? ledger.bets : [];
  const summary = ledger.summary || {};
  const openBets = useMemo(() => bets.filter((bet) => String(bet.status || "").toLowerCase() === "open"), [bets]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950 sm:px-8">
      <section className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Member bet ledger</div>
            <h1 className="mt-2 text-3xl font-black tracking-normal">Your tracked bets</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Telegram replies and manual tails for {userEmail || "your account"} land here with stake, book, odds, CLV, grading status, and notes.
            </p>
          </div>
          <a href="/picks" className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-100">
            Back to research board
          </a>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-6">
          <Metric label="Total" value={summary.total ?? 0} />
          <Metric label="Open" value={summary.open ?? openBets.length} tone="warn" />
          <Metric label="Record" value={`${summary.wins ?? 0}-${summary.losses ?? 0}${summary.pushes ? `-${summary.pushes}` : ""}`} />
          <Metric label="P&L" value={money(summary.pnl)} tone={Number(summary.pnl) >= 0 ? "good" : "bad"} />
          <Metric label="ROI" value={pct(summary.roi)} tone={Number(summary.roi) >= 0 ? "good" : "bad"} />
          <Metric label="Avg CLV" value={pct(summary.avg_clv_pct)} tone={Number(summary.avg_clv_pct) >= 0 ? "good" : "bad"} />
        </div>

        {!ledger.ok && (
          <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Ledger data is temporarily unavailable: {ledger.error || "unknown error"}
          </div>
        )}

        <div className="mb-5 rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold">Connect Telegram replies</h2>
              <p className="mt-1 text-sm text-slate-600">
                Send this command in Telegram so replies and one-tap tails land in this private ledger for {userEmail || "your account"}.
              </p>
            </div>
            <button
              type="button"
              onClick={refreshTelegramCode}
              className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-100"
            >
              New code
            </button>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="rounded-lg border bg-slate-50 px-3 py-2 text-sm font-bold text-slate-950">
              {telegramLink.loading ? "Loading..." : telegramLink.command || "Code unavailable"}
            </code>
            {telegramLink.expires_at && <span className="text-xs text-slate-500">Expires {dateLabel(telegramLink.expires_at)}</span>}
          </div>
          {!telegramLink.ok && !telegramLink.loading && (
            <p className="mt-2 text-xs text-amber-700">Telegram linking is temporarily unavailable: {telegramLink.error || "unknown error"}</p>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="border-b px-4 py-3">
            <h2 className="text-base font-bold">Bet history</h2>
            <p className="text-xs text-slate-500">{loading ? "Loading..." : `${bets.length} rows shown`}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Placed</th>
                  <th className="px-4 py-3">Game</th>
                  <th className="px-4 py-3">Pick</th>
                  <th className="px-4 py-3">Book</th>
                  <th className="px-4 py-3">Stake</th>
                  <th className="px-4 py-3">Result</th>
                  <th className="px-4 py-3">P&L</th>
                  <th className="px-4 py-3">CLV</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bets.map((bet) => (
                  <tr key={bet.tail_bet_id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{dateLabel(bet.placed_at)}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{bet.game || "Game not linked"}</div>
                      <div className="text-xs text-slate-500">{bet.market || "-"}</div>
                    </td>
                    <td className="px-4 py-3 font-semibold">{bet.pick_side || "-"}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {bet.sportsbook || "-"} <span className="font-semibold">{odds(bet.odds_american)}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{money(bet.stake)}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-bold ${statusTone(bet)}`}>
                        {bet.result || bet.status || "open"}
                      </span>
                    </td>
                    <td className={`whitespace-nowrap px-4 py-3 font-bold ${Number(bet.pnl) >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                      {money(bet.pnl)}
                    </td>
                    <td className={`whitespace-nowrap px-4 py-3 font-semibold ${Number(bet.clv_pct) >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                      {pct(bet.clv_pct)}
                    </td>
                    <td className="min-w-[260px] max-w-md px-4 py-3 text-xs text-slate-600">{bet.notes || "-"}</td>
                  </tr>
                ))}
                {!loading && bets.length === 0 && (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-slate-500" colSpan={9}>
                      No tracked bets yet. Reply to a Telegram alert like "I bet $20 DK +107" and it will appear here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value, tone = "neutral" }) {
  const toneClass =
    tone === "good"
      ? "text-emerald-700"
      : tone === "bad"
        ? "text-rose-700"
        : tone === "warn"
          ? "text-amber-700"
          : "text-slate-950";
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-2 text-2xl font-black ${toneClass}`}>{value}</div>
    </div>
  );
}

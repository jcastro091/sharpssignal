import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { requireCeoPageAccess } from "../lib/ceoAccess";

export async function getServerSideProps({ req, res }) {
  const access = await requireCeoPageAccess(req, res);
  if (!access.user) {
    return {
      redirect: {
        destination: access.redirect || "/signin?next=%2Fceo-dashboard",
        permanent: false,
      },
    };
  }
  if (!access.allowed) {
    return {
      redirect: {
        destination: access.redirect || "/picks",
        permanent: false,
      },
    };
  }
  return {
    props: {
      userEmail: access.email || access.user.email || "",
      allowlistConfigured: access.allowlistConfigured,
    },
  };
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

function num(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString();
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

function toneForAction(action) {
  const normalized = String(action || "").toUpperCase();
  if (normalized === "BET") return "border-emerald-300 bg-emerald-50 text-emerald-950";
  if (normalized === "WATCH") return "border-amber-300 bg-amber-50 text-amber-950";
  return "border-rose-300 bg-rose-50 text-rose-950";
}

export default function CeoDashboardPage({ userEmail = "", allowlistConfigured = false }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch("/api/ceo-dashboard", { headers: { "Cache-Control": "no-cache" } });
        const payload = await response.json();
        if (!active) return;
        if (!payload.ok) setError(payload.error || "CEO dashboard unavailable");
        setData(payload);
      } catch (err) {
        if (active) setError(err?.message || "CEO dashboard unavailable");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    const timer = setInterval(load, 5 * 60 * 1000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const betting = data?.betting || {};
  const growth = data?.growth || {};
  const tail = data?.tail_bets || {};
  const schema = data?.schema || {};
  const api = data?.api_usage || {};
  const runner = data?.runner || {};
  const mlb = betting.mlb_h2h_underdogs || {};
  const sourceHealth = data?.source_health || {};
  const nextActions = Array.isArray(data?.next_actions) ? data.next_actions : [];
  const sourceRows = Array.isArray(growth.source_rows) ? growth.source_rows : [];
  const missingColumns = Array.isArray(schema.missing) ? schema.missing : [];
  const previewCounts = betting.preview_counts || {};
  const generatedAt = useMemo(() => dateLabel(data?.generated_at), [data?.generated_at]);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-8">
      <section className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-col gap-3 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-cyan-300">SharpsSignal CEO control center</div>
            <h1 className="mt-2 text-3xl font-black tracking-normal sm:text-4xl">Daily Betting Readiness</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              One operator view for betting readiness, MLB H2H underdog probation, funnel conversion, API burn, and the next bottleneck.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/picks" className="rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15">
              Research board
            </Link>
            <Link href="/bets" className="rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15">
              Bet ledger
            </Link>
          </div>
        </div>

        {!allowlistConfigured && (
          <div className="mb-5 rounded-lg border border-amber-300 bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-950">
            Owner allowlist is not configured. Set <code>CEO_DASHBOARD_EMAILS</code> in production so only approved operator emails can access this page.
          </div>
        )}

        {error && (
          <div className="mb-5 rounded-lg border border-rose-300 bg-rose-100 px-4 py-3 text-sm font-semibold text-rose-950">
            {error}
          </div>
        )}

        <section className={`mb-5 rounded-xl border p-5 shadow-lg ${toneForAction(betting.action)}`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-wide">Should we bet today?</div>
              <div className="mt-2 text-5xl font-black">{loading ? "Loading" : betting.action || "SKIP"}</div>
              <p className="mt-3 max-w-4xl text-sm font-semibold">{betting.explanation || "Waiting for live readiness data."}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Metric label="Official Picks" value={num(previewCounts.officialPicksToday || 0)} dark={false} />
              <Metric label="Shadow Groups" value={num(previewCounts.shadowGroupsToday || 0)} dark={false} />
              <Metric label="Schema" value={schema.status || "unknown"} dark={false} />
              <Metric label="Updated" value={generatedAt} dark={false} />
            </div>
          </div>
        </section>

        <div className="mb-5 grid gap-4 lg:grid-cols-3">
          <Panel title="MLB H2H Underdog Probation" subtitle="First beachhead, not a profitability claim">
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Lane Status" value={mlb.status || "-"} />
              <Metric label="Action" value={mlb.bet_action || "-"} />
              <Metric label="Closed" value={num(mlb.closed)} />
              <Metric label="Record" value={mlb.record || "-"} />
              <Metric label="Avg CLV" value={pct(mlb.avg_clv_pct)} />
              <Metric label="CLV Coverage" value={pct(mlb.clv_coverage)} />
            </div>
            <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
              <div><span className="text-slate-400">Best retail:</span> {mlb.current_best_retail_book || "Not persisted yet"}</div>
              <div><span className="text-slate-400">Min bettable:</span> {mlb.minimum_bettable_odds || "Not persisted yet"}</div>
            </div>
          </Panel>

          <Panel title="Growth Funnel" subtitle="Last 30 days">
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Signup Views" value={num(growth.page_signup_views)} />
              <Metric label="Signup Submits" value={num(growth.signup_submits)} />
              <Metric label="Leads" value={num(growth.leads)} />
              <Metric label="Plan Views" value={num(growth.plan_views)} />
              <Metric label="Checkout Clicks" value={num(growth.checkout_clicks)} />
              <Metric label="Active Paid" value={num(growth.active_paid)} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <MiniStat label="Signup to checkout" value={pct(growth.signup_to_checkout_rate)} />
              <MiniStat label="Plan to checkout" value={pct(growth.plan_to_checkout_rate)} />
              <MiniStat label="Checkout to paid" value={pct(growth.checkout_to_paid_rate)} />
            </div>
          </Panel>

          <Panel title="Personal Tail Results" subtitle="Last 7 days">
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Logged" value={num(tail.count)} />
              <Metric label="Open" value={num(tail.open)} />
              <Metric label="Closed" value={num(tail.closed)} />
              <Metric label="Record" value={tail.record || "-"} />
              <Metric label="P&L" value={money(tail.pnl)} />
              <Metric label="ROI" value={pct(tail.roi)} />
            </div>
            <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
              Avg CLV: <span className="font-bold text-white">{pct(tail.avg_clv_pct)}</span>
            </div>
          </Panel>
        </div>

        <div className="mb-5 grid gap-4 lg:grid-cols-2">
          <Panel title="Current Bottleneck" subtitle="The next thing that blocks making money">
            <p className="text-lg font-bold text-white">{data?.next_bottleneck || "Loading..."}</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-200">
              {nextActions.map((action) => (
                <li key={action} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">{action}</li>
              ))}
              {!nextActions.length && <li className="text-slate-400">No urgent action loaded yet.</li>}
            </ul>
          </Panel>

          <Panel title="Data Health" subtitle="Hard blockers and source checks">
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Missing Columns" value={num(schema.missing_count)} />
              <Metric label="API Used" value={`${num(api.used)} / ${num(api.cap)}`} />
              <Metric label="API Remaining" value={num(api.remaining)} />
              <Metric label="Runner" value={runner.latest_status || "-"} />
            </div>
            <div className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
              {Object.entries(sourceHealth).map(([key, value]) => (
                <div key={key} className="rounded border border-white/10 bg-white/5 px-3 py-2">
                  <span className="text-slate-500">{key}</span>: <span className="font-bold text-white">{String(value)}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Missing Schema Columns" subtitle="Why attribution and bettable windows are still blocked">
            <div className="max-h-72 overflow-auto rounded-lg border border-white/10">
              <table className="min-w-full divide-y divide-white/10 text-sm">
                <thead className="bg-white/5 text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Table</th>
                    <th className="px-3 py-2">Column</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {missingColumns.map((item) => (
                    <tr key={`${item.table}.${item.column}`}>
                      <td className="px-3 py-2 font-semibold">{item.table}</td>
                      <td className="px-3 py-2 text-slate-300">{item.column}</td>
                    </tr>
                  ))}
                  {!missingColumns.length && (
                    <tr><td className="px-3 py-4 text-slate-400" colSpan={2}>Schema is ready.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Attribution Sources" subtitle="Top tracked funnel sources">
            <div className="max-h-72 overflow-auto rounded-lg border border-white/10">
              <table className="min-w-full divide-y divide-white/10 text-sm">
                <thead className="bg-white/5 text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2">Events</th>
                    <th className="px-3 py-2">Checkout</th>
                    <th className="px-3 py-2">Paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {sourceRows.map((row) => (
                    <tr key={row.source}>
                      <td className="px-3 py-2 font-semibold">{row.source}</td>
                      <td className="px-3 py-2">{num(row.events)}</td>
                      <td className="px-3 py-2">{num(row.checkout_clicks)}</td>
                      <td className="px-3 py-2">{num(row.subscribe_success)}</td>
                    </tr>
                  ))}
                  {!sourceRows.length && (
                    <tr><td className="px-3 py-4 text-slate-400" colSpan={4}>No source rows loaded yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <div className="mt-5 text-xs text-slate-500">
          Signed in as {userEmail}. This page auto-refreshes every 5 minutes.
        </div>
      </section>
    </main>
  );
}

function Panel({ title, subtitle, children }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4 shadow-lg">
      <div className="mb-3">
        <h2 className="text-base font-black text-white">{title}</h2>
        {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value, dark = true }) {
  return (
    <div className={`rounded-lg border p-3 ${dark ? "border-white/10 bg-white/5" : "border-black/10 bg-white/60"}`}>
      <div className="text-[11px] font-bold uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-1 break-words text-lg font-black">{value ?? "-"}</div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-black text-white">{value}</div>
    </div>
  );
}

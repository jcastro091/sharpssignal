import Head from "next/head";
import Link from "next/link";
import type { GetServerSideProps } from "next";
import { loadAuditedRecord, type AuditedRecord } from "../lib/publicGrowth";

type Props = {
  record: AuditedRecord;
};

function pct(value: number | null | undefined) {
  if (value == null) return "n/a";
  return `${(value * 100).toFixed(1)}%`;
}

function money(value: number | null | undefined) {
  if (value == null) return "n/a";
  return `$${Number(value).toFixed(2)}`;
}

export default function RecordPage({ record }: Props) {
  const kpis = record.kpis || {};
  const hasSample = Number(kpis.closed || 0) > 0;

  return (
    <>
      <Head>
        <title>Audited Record | SharpSignal</title>
        <meta
          name="description"
          content="SharpSignal audited betting record: official closed picks only, graded after results settle, with ROI, CLV, and sample-size warnings."
        />
        <link rel="canonical" href="https://www.sharps-signal.com/record" />
      </Head>

      <main className="bg-white text-slate-950">
        <section className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <div className="max-w-3xl">
              <div className="inline-flex rounded border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-700">
                Official closed bets only
              </div>
              <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">Audited Record</h1>
              <p className="mt-4 text-lg leading-8 text-slate-600">
                This page excludes open picks, ungraded observations, and rows missing closing-line data. The goal is
                simple: let the record earn trust before anyone treats the model like a bankroll engine.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="rounded border border-amber-200 bg-amber-50 p-5 text-amber-950">
            <div className="text-sm font-semibold uppercase tracking-wide">Sample status: {record.sample_status.label}</div>
            <p className="mt-2 text-sm leading-6">{record.sample_status.message}</p>
            {record.sample_status.next_threshold && (
              <p className="mt-2 text-sm">
                Next checkpoint: {record.sample_status.next_threshold} official closed bets.
              </p>
            )}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Metric label="Closed" value={String(kpis.closed || 0)} />
            <Metric label="Wins" value={String(kpis.wins || 0)} />
            <Metric label="P&L" value={money(kpis.pnl)} />
            <Metric label="ROI" value={pct(kpis.roi as number | null)} />
            <Metric label="Avg CLV" value={pct(kpis.avg_clv_pct as number | null)} />
          </div>

          {!hasSample && (
            <div className="mt-8 rounded border border-slate-200 bg-white p-6">
              <h2 className="text-xl font-semibold">No public audited sample yet</h2>
              <p className="mt-2 leading-7 text-slate-600">
                The live system is logging observations, but the public record only counts official closed picks with
                closing odds and CLV. Once those rows settle, this page will populate automatically.
              </p>
              <div className="mt-5">
                <Link href="/picks-preview" className="rounded bg-slate-950 px-5 py-3 font-semibold text-white hover:bg-slate-800">
                  View current preview
                </Link>
              </div>
            </div>
          )}

          {record.leaderboard.length > 0 && (
            <div className="mt-10">
              <h2 className="text-2xl font-semibold">Segment Performance</h2>
              <div className="mt-4 overflow-x-auto rounded border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      <Th>Sport</Th>
                      <Th>Market</Th>
                      <Th>Tier</Th>
                      <Th>Closed</Th>
                      <Th>ROI</Th>
                      <Th>Avg CLV</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {record.leaderboard.map((row, idx) => (
                      <tr key={`${row.sport}-${row.market}-${row.tier_code}-${idx}`}>
                        <Td>{row.sport}</Td>
                        <Td>{row.market}</Td>
                        <Td>{row.tier_code || "-"}</Td>
                        <Td>{row.closed}</Td>
                        <Td>{pct(row.roi as number | null)}</Td>
                        <Td>{pct(row.avg_clv_pct as number | null)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="mt-10 rounded border border-slate-200 bg-slate-50 p-6">
            <h2 className="text-2xl font-semibold">Weekly Reports</h2>
            <p className="mt-2 leading-7 text-slate-600">
              Weekly reports roll up the same audited rows into Monday-Sunday windows. They are the links to post on X,
              Telegram, email, and creator partner channels.
            </p>
            <Link href="/reports/weekly" className="mt-4 inline-flex rounded bg-slate-950 px-5 py-3 font-semibold text-white hover:bg-slate-800">
              Open weekly reports
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-slate-200 bg-white p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}

function Th({ children }: { children: any }) {
  return <th className="px-4 py-3 font-semibold">{children}</th>;
}

function Td({ children }: { children: any }) {
  return <td className="px-4 py-3 text-slate-700">{children}</td>;
}

export const getServerSideProps: GetServerSideProps<Props> = async ({ res }) => {
  const record = await loadAuditedRecord();
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
  return { props: { record } };
};

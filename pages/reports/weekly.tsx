import Head from "next/head";
import Link from "next/link";
import type { GetServerSideProps } from "next";
import { loadAuditedRecord, type AuditedRecord, type WeeklyReport } from "../../lib/publicGrowth";

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

export default function WeeklyReportsPage({ record }: Props) {
  const latest = record.weekly_reports[0] || null;

  return (
    <>
      <Head>
        <title>Weekly Audited Reports | SharpSignal</title>
        <meta
          name="description"
          content="SharpSignal weekly audited reports: official closed bets only, rolled up by week with ROI, win rate, CLV, and sample size."
        />
        <link rel="canonical" href="https://www.sharps-signal.com/reports/weekly" />
      </Head>

      <main className="bg-white text-slate-950">
        <section className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <div className="max-w-3xl">
              <div className="inline-flex rounded border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-700">
                Monday-Sunday audited recaps
              </div>
              <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">Weekly Reports</h1>
              <p className="mt-4 text-lg leading-8 text-slate-600">
                These reports are the public weekly artifact: official closed bets only, no open plays, no guarantees,
                and clear sample-size warnings until the record matures.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          {latest ? <FeaturedReport report={latest} /> : <EmptyState />}

          <div className="mt-10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold">Report Archive</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Post this page publicly every Monday after grading and CLV capture are complete.
                </p>
              </div>
              <Link href="/record" className="text-sm font-semibold text-slate-950 underline">
                View full audited record
              </Link>
            </div>

            {record.weekly_reports.length > 0 ? (
              <div className="mt-4 overflow-x-auto rounded border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      <Th>Week</Th>
                      <Th>Closed</Th>
                      <Th>Record</Th>
                      <Th>Win Rate</Th>
                      <Th>ROI</Th>
                      <Th>P&L</Th>
                      <Th>Avg CLV</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {record.weekly_reports.map((report) => (
                      <tr key={report.week_start}>
                        <Td>{report.week_start} to {report.week_end}</Td>
                        <Td>{report.closed}</Td>
                        <Td>{report.wins}-{report.losses}-{report.pushes}</Td>
                        <Td>{pct(report.win_rate)}</Td>
                        <Td>{pct(report.roi)}</Td>
                        <Td>{money(report.pnl)}</Td>
                        <Td>{pct(report.avg_clv_pct)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-4 rounded border border-slate-200 bg-white p-6 text-slate-600">
                No weekly audited reports yet. They will appear after official closed bets have closing-line data.
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  );
}

function FeaturedReport({ report }: { report: WeeklyReport }) {
  return (
    <div className="rounded border border-slate-200 bg-slate-950 p-6 text-white">
      <div className="text-sm font-semibold uppercase tracking-wide text-slate-300">Latest weekly report</div>
      <h2 className="mt-2 text-3xl font-bold">{report.week_start} to {report.week_end}</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <DarkMetric label="Closed" value={String(report.closed)} />
        <DarkMetric label="Record" value={`${report.wins}-${report.losses}-${report.pushes}`} />
        <DarkMetric label="ROI" value={pct(report.roi)} />
        <DarkMetric label="P&L" value={money(report.pnl)} />
        <DarkMetric label="Avg CLV" value={pct(report.avg_clv_pct)} />
      </div>
      <p className="mt-5 text-sm leading-6 text-slate-300">
        Informational only. No guarantees. Results are volatile until the sample is large enough to review by segment.
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded border border-amber-200 bg-amber-50 p-6 text-amber-950">
      <h2 className="text-xl font-semibold">No weekly audited report yet</h2>
      <p className="mt-2 leading-7">
        The page is live, but the public weekly report waits for official closed bets with closing odds and CLV.
        This is exactly the kind of patience that keeps the proof page honest.
      </p>
    </div>
  );
}

function DarkMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-white/15 bg-white/10 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-300">{label}</div>
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

import Head from "next/head";
import Link from "next/link";
import { Activity, ArrowRight, BarChart3, LockKeyhole, ShieldCheck, Trophy } from "lucide-react";

const engines = [
  {
    icon: Trophy,
    eyebrow: "Sports",
    title: "Sports market intelligence",
    body: "The sports engine evaluates price, timing, market movement, and closing-line evidence across moneylines, spreads, and totals.",
    detail: "Research and paper validation are active. No short run is presented as proof of a durable edge.",
  },
  {
    icon: Activity,
    eyebrow: "Markets",
    title: "Systematic FX research",
    body: "The markets engine monitors selected currency pairs with defined entries, exits, execution costs, financing, and risk limits.",
    detail: "Trading remains paper-only while the sample grows. Two closed wins are an observation, not a profitability claim.",
  },
];

export default function Home() {
  return (
    <>
      <Head>
        <title>SharpsSignal | Sports + Markets Intelligence</title>
        <meta name="description" content="Two research engines for sports and currency markets, with private verification and aggregate attestation." />
      </Head>

      <main className="bg-slate-950 text-white">
        <section className="relative overflow-hidden border-b border-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,.22),_transparent_40%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,.18),_transparent_38%)]" />
          <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
            <div className="max-w-4xl">
              <div className="inline-flex rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-sm font-semibold text-emerald-200">
                Sports + Markets
              </div>
              <h1 className="mt-6 text-5xl font-black tracking-tight sm:text-6xl lg:text-7xl">
                Market intelligence built to earn trust over time.
              </h1>
              <p className="mt-6 max-w-3xl text-xl leading-8 text-slate-300">
                SharpsSignal operates two evidence-driven research engines: one for sports markets and one for foreign exchange. We measure first, verify privately, and make no claim that an early winning run proves profitability.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link href="/verification" className="inline-flex items-center justify-center gap-2 rounded bg-emerald-400 px-6 py-3 font-bold text-slate-950 hover:bg-emerald-300">
                  How verification works <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/subscribe" className="inline-flex items-center justify-center rounded border border-white/25 px-6 py-3 font-semibold hover:bg-white/10">
                  Request access
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {engines.map(({ icon: Icon, eyebrow, title, body, detail }) => (
              <article key={title} className="rounded-2xl border border-white/10 bg-white/[.04] p-7">
                <div className="flex items-center gap-3 text-emerald-300"><Icon className="h-6 w-6" /><span className="font-bold uppercase tracking-widest">{eyebrow}</span></div>
                <h2 className="mt-5 text-3xl font-bold">{title}</h2>
                <p className="mt-4 leading-7 text-slate-300">{body}</p>
                <p className="mt-5 rounded border border-white/10 bg-slate-900 p-4 text-sm leading-6 text-slate-400">{detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-white/10 bg-white/[.03]">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[.85fr_1.15fr]">
            <div>
              <div className="flex items-center gap-2 text-emerald-300"><ShieldCheck className="h-5 w-5" /><span className="font-semibold">Verification without exposure</span></div>
              <h2 className="mt-4 text-4xl font-bold">Proof should protect the edge.</h2>
              <p className="mt-4 leading-7 text-slate-300">Individual historical plays, the public ledger, betting logic, and source code are not published. Qualified members may receive current verified plays; independent reviewers may inspect timestamped records privately.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TrustCard icon={LockKeyhole} title="Private verification" body="Controlled, read-only review of timestamped signals, execution assumptions, and settled outcomes." />
              <TrustCard icon={BarChart3} title="Aggregate attestation" body="Sample size, coverage, return, drawdown, and methodology notes without play-level disclosure." />
              <TrustCard icon={ShieldCheck} title="No cherry-picking" body="Cohorts are defined before evaluation, and weak or inconclusive periods remain in the aggregate." />
              <TrustCard icon={Activity} title="Research status visible" body="Paper trading and research cohorts are labeled clearly; early streaks are not marketed as established performance." />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
          <h2 className="text-4xl font-bold">Access the signal, not the blueprint.</h2>
          <p className="mx-auto mt-4 max-w-2xl leading-7 text-slate-300">SharpsSignal is preparing controlled access for verified current plays and private diligence. Historical selections and proprietary decision logic remain confidential.</p>
          <Link href="/subscribe" className="mt-8 inline-flex items-center gap-2 rounded bg-white px-6 py-3 font-bold text-slate-950 hover:bg-slate-100">Request access <ArrowRight className="h-4 w-4" /></Link>
          <p className="mt-6 text-xs leading-5 text-slate-500">Sports betting and currency trading involve substantial risk. Research results, paper results, and verified records do not guarantee future performance. SharpsSignal does not currently accept customer funds or place wagers or trades on a customer&apos;s behalf.</p>
        </section>
      </main>
    </>
  );
}

function TrustCard({ icon: Icon, title, body }) {
  return <div className="rounded-xl border border-white/10 bg-slate-950 p-5"><Icon className="h-5 w-5 text-emerald-300" /><h3 className="mt-3 font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{body}</p></div>;
}

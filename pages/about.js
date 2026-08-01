import Head from "next/head";
import Link from "next/link";
import { Activity, CandlestickChart, ShieldCheck, Trophy } from "lucide-react";

export default function About() {
  return <>
    <Head><title>Sports + Markets | SharpsSignal</title><meta name="description" content="How SharpsSignal researches sports and foreign-exchange markets." /></Head>
    <main className="bg-slate-50 text-slate-950">
      <section className="border-b border-slate-200 bg-white"><div className="mx-auto max-w-6xl px-4 py-16 sm:px-6"><div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold"><Activity className="h-4 w-4" /> Two engines, one evidence standard</div><h1 className="mt-5 max-w-4xl text-5xl font-black tracking-tight">Sports and financial markets demand different models—and the same discipline.</h1><p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">SharpsSignal separates signal generation from performance claims. Every cohort must accumulate enough forward evidence, realistic costs, and comparable market data before it can support a conclusion.</p></div></section>
      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-12 sm:px-6 lg:grid-cols-2">
        <Engine icon={Trophy} title="Sports engine" items={["Tracks market price and movement before start time", "Grades moneylines, spreads, and totals by predefined cohort", "Counts CLV only when the offered and closing lines are directly comparable", "Keeps historical play details and model logic private"]} />
        <Engine icon={CandlestickChart} title="Markets engine" items={["Monitors selected FX pairs under fixed paper-trading rules", "Attributes spread, commission, slippage, and rollover financing", "Links every closed trade back to its originating signal", "Treats early wins as datapoints, not profitability proof"]} />
      </section>
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6"><div className="rounded-2xl bg-slate-950 p-8 text-white"><ShieldCheck className="h-7 w-7 text-emerald-300" /><h2 className="mt-4 text-3xl font-bold">What we disclose</h2><p className="mt-4 max-w-3xl leading-7 text-slate-300">We can disclose aggregate sample size, methodology, coverage, return, drawdown, and verification scope. We do not publish a play-by-play ledger, free historical selections, proprietary thresholds, or code.</p><Link href="/verification" className="mt-6 inline-flex rounded bg-emerald-400 px-5 py-3 font-bold text-slate-950">Read the verification standard</Link></div></section>
    </main>
  </>;
}

function Engine({ icon: Icon, title, items }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-7"><Icon className="h-7 w-7 text-emerald-600" /><h2 className="mt-4 text-2xl font-bold">{title}</h2><ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600">{items.map(item => <li key={item} className="flex gap-3"><span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />{item}</li>)}</ul></article>;
}

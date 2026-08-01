import Head from "next/head";
import Link from "next/link";
import { CheckCircle2, LockKeyhole } from "lucide-react";

export default function AccessPage() {
  return <>
    <Head><title>Access | SharpsSignal</title><meta name="description" content="Request controlled access to SharpsSignal sports and markets intelligence." /></Head>
    <main className="min-h-[70vh] bg-slate-50 text-slate-950"><section className="mx-auto max-w-5xl px-4 py-16 sm:px-6"><div className="max-w-3xl"><div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-800">Controlled access</div><h1 className="mt-5 text-5xl font-black tracking-tight">Verified current signals without exposing the strategy.</h1><p className="mt-5 text-lg leading-8 text-slate-600">We are preparing paid access for qualified users. Access is designed around current verified plays and aggregate research attestation—not a public ledger or a downloadable history.</p></div>
      <div className="mt-10 grid gap-6 lg:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-7"><h2 className="text-2xl font-bold">Included in controlled access</h2><ul className="mt-5 space-y-3 text-sm text-slate-700">{["Current eligible sports signals", "Current eligible markets signals when activated", "Clear timing, price, risk, and status information", "Aggregate performance and risk context"].map(item => <li className="flex gap-2" key={item}><CheckCircle2 className="h-5 w-5 text-emerald-600" />{item}</li>)}</ul></div><div className="rounded-2xl border border-slate-950 bg-slate-950 p-7 text-white"><LockKeyhole className="h-6 w-6 text-emerald-300" /><h2 className="mt-4 text-2xl font-bold">Kept private</h2><ul className="mt-5 space-y-3 text-sm text-slate-300">{["Historical play-by-play ledger", "Free historical selections", "Model thresholds and feature logic", "Source code and execution rules"].map(item => <li key={item}>{item}</li>)}</ul></div></div>
      <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">Access is not yet a promise of profitability. The current forex wins and sports totals run are small samples and are not offered as proof of a durable edge.</div>
      <div className="mt-8 flex gap-3"><Link href="/contact" className="rounded bg-slate-950 px-5 py-3 font-bold text-white">Request access</Link><Link href="/verification" className="rounded border border-slate-300 bg-white px-5 py-3 font-semibold">Verification details</Link></div></section></main>
  </>;
}

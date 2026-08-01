import Head from "next/head";
import { BarChart3, Eye, LockKeyhole, ShieldCheck } from "lucide-react";

const cards = [
  [LockKeyhole, "Private evidence room", "A qualified reviewer can inspect immutable timestamps, offered prices, closing evidence, grading, and execution-cost attribution under controlled access."],
  [BarChart3, "Aggregate attestation", "Public-facing claims, when available, use cohort-level sample size, return, drawdown, CLV coverage, and methodology notes—never a list of past plays."],
  [Eye, "Comparable data only", "Sports spread and total CLV counts only when the offered line exactly matches the closing line. Missing line evidence is excluded."],
  [ShieldCheck, "No streak marketing", "Short winning runs can motivate more research, but they do not establish repeatable profitability."],
];

export default function Verification() {
  return <><Head><title>Private Verification | SharpsSignal</title><meta name="description" content="SharpsSignal private verification and aggregate attestation standards." /></Head><main className="bg-white text-slate-950"><section className="border-b bg-slate-950 text-white"><div className="mx-auto max-w-6xl px-4 py-16 sm:px-6"><h1 className="max-w-4xl text-5xl font-black tracking-tight">Verify the record without publishing the edge.</h1><p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">SharpsSignal does not promise a public ledger or free historical plays. Verification is private; external communication is aggregate and sample-size aware.</p></div></section><section className="mx-auto grid max-w-6xl gap-5 px-4 py-14 sm:px-6 md:grid-cols-2">{cards.map(([Icon,title,body]) => <article key={title} className="rounded-xl border border-slate-200 p-6"><Icon className="h-6 w-6 text-emerald-600" /><h2 className="mt-4 text-xl font-bold">{title}</h2><p className="mt-3 text-sm leading-6 text-slate-600">{body}</p></article>)}</section><section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6"><div className="rounded-xl border border-slate-200 bg-slate-50 p-6"><h2 className="text-xl font-bold">Current status</h2><p className="mt-3 leading-7 text-slate-600">Both engines remain in evidence collection and paper validation. Any future attestation will distinguish research observations, paper outcomes, and live results and will state the sample window and limitations.</p></div></section></main></>;
}

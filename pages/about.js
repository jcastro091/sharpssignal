import Head from "next/head";
import Link from "next/link";
import { Activity, BarChart3, ClipboardCheck, ShieldCheck } from "lucide-react";

const process = [
  {
    icon: Activity,
    title: "Model watches the market",
    body: "Odds, movement, timing, and model probability are evaluated before a play is surfaced.",
  },
  {
    icon: ClipboardCheck,
    title: "Picks are logged",
    body: "Each pick is timestamped before the event starts so the record can be audited later.",
  },
  {
    icon: BarChart3,
    title: "Results are graded",
    body: "The dashboard shows recent performance, stale-pick status, and model health instead of hiding bad stretches.",
  },
];

export default function About() {
  return (
    <>
      <Head>
        <title>Proof Process | SharpSignal</title>
        <meta
          name="description"
          content="How SharpSignal builds trust: timestamped picks, graded results, model health, and transparent dashboard reporting."
        />
      </Head>

      <main className="bg-white text-slate-950">
        <section className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-700">
                <ShieldCheck className="h-4 w-4" /> Built for accountability
              </div>
              <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">
                The product is not the pick. The product is the record.
              </h1>
              <p className="mt-4 text-lg leading-8 text-slate-600">
                SharpSignal exists to make betting signals easier to inspect. If a model is good, its record should
                survive daylight: what it picked, when it picked it, what odds were available, and how it performed.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/picks-preview" className="rounded bg-slate-950 px-5 py-3 text-center font-semibold text-white hover:bg-slate-800">
                  View public preview
                </Link>
                <Link href="/subscribe" className="rounded border border-slate-300 px-5 py-3 text-center font-semibold text-slate-700 hover:bg-slate-50">
                  See pricing
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="grid gap-5 md:grid-cols-3">
            {process.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded border border-slate-200 bg-white p-6">
                <Icon className="h-7 w-7 text-slate-800" />
                <h2 className="mt-4 text-lg font-semibold">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 grid gap-8 rounded border border-slate-200 bg-slate-50 p-6 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <h2 className="text-2xl font-semibold">What we are transparent about</h2>
              <p className="mt-3 leading-7 text-slate-600">
                The dashboard is designed to show the parts that matter: current picks, stale-run warnings,
                graded history, win rate, ROI, and model health. If the system is not producing picks, that should be visible too.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                "Timestamp before event start",
                "Recent results and ROI",
                "Model health alerts",
                "No guarantee language",
                "Stripe-managed billing",
                "Telegram after payment verification",
              ].map((item) => (
                <div key={item} className="rounded bg-white p-4 text-sm font-medium text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

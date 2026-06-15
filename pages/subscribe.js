import Head from "next/head";
import Link from "next/link";
import { CheckCircle2, Lock, Radio, ReceiptText } from "lucide-react";
import { trackFunnelEvent } from "../lib/funnelClient";

const proofItems = [
  "Every pick is timestamped before game time.",
  "Results are graded in the dashboard after settlement.",
  "Model health and recent performance are visible, including weak periods.",
];

export default function SubscribePage() {
  const checkoutUrl = process.env.NEXT_PUBLIC_CHECKOUT_URL_STARTER || "/signup?next=%2Fpicks";

  return (
    <>
      <Head>
        <title>Pricing | SharpSignal</title>
        <meta
          name="description"
          content="Choose free dashboard access or realtime SharpSignal Telegram alerts. Picks are timestamped, logged, and graded."
        />
      </Head>

      <main className="bg-slate-50 text-slate-950">
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="max-w-3xl">
            <div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-800">
              Transparent picks, not hype
            </div>
            <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">
              Start with the public record. Upgrade only if the process earns trust.
            </h1>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              SharpSignal is built around a simple promise: picks should be logged, auditable,
              and easy to grade. Free users can inspect the dashboard. Pro users get realtime
              Telegram alerts when the model fires.
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            <div className="rounded border border-slate-200 bg-white p-6">
              <div className="flex items-center gap-3">
                <ReceiptText className="h-6 w-6 text-slate-700" />
                <h2 className="text-2xl font-semibold">Free Dashboard</h2>
              </div>
              <p className="mt-3 text-slate-600">
                Best for checking the record, browsing recent picks, and understanding the model before paying.
              </p>
              <div className="mt-6 text-4xl font-bold">$0</div>
              <ul className="mt-6 space-y-3 text-sm text-slate-700">
                <li className="flex gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" /> Picks preview and public proof</li>
                <li className="flex gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" /> Dashboard access and filters</li>
                <li className="flex gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" /> Model performance context</li>
              </ul>
              <Link
                href="/signup?next=%2Fpicks"
                className="mt-8 inline-flex w-full items-center justify-center rounded bg-slate-950 px-5 py-3 font-semibold text-white hover:bg-slate-800"
              >
                Create free account
              </Link>
            </div>

            <div className="rounded border border-slate-950 bg-slate-950 p-6 text-white">
              <div className="flex items-center gap-3">
                <Radio className="h-6 w-6 text-emerald-300" />
                <h2 className="text-2xl font-semibold">Pro Telegram Alerts</h2>
              </div>
              <p className="mt-3 text-slate-300">
                Best for users who want the alert when the pick is generated, not after they remember to check the dashboard.
              </p>
              <div className="mt-6 flex items-end gap-2">
                <span className="text-4xl font-bold">$20</span>
                <span className="pb-1 text-slate-300">/ month</span>
              </div>
              <ul className="mt-6 space-y-3 text-sm text-slate-200">
                <li className="flex gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-300" /> Realtime Telegram pick alerts</li>
                <li className="flex gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-300" /> Full dashboard and pick history</li>
                <li className="flex gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-300" /> Stripe-managed billing and cancellation</li>
              </ul>
              <a
                href={checkoutUrl}
                className="mt-8 inline-flex w-full items-center justify-center rounded bg-emerald-400 px-5 py-3 font-semibold text-slate-950 hover:bg-emerald-300"
                onClick={() => trackFunnelEvent("checkout_click", { location: "subscribe_pricing", plan: "pro_telegram" })}
              >
                Unlock realtime alerts
              </a>
              <p className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-400">
                <Lock className="h-4 w-4" /> After payment, the dashboard verifies Stripe and reveals the Telegram invite.
              </p>
            </div>
          </div>

          <div className="mt-10 rounded border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-semibold">How we earn trust</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {proofItems.map((item) => (
                <div key={item} className="rounded bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                  {item}
                </div>
              ))}
            </div>
            <p className="mt-5 text-sm text-slate-500">
              Sports betting involves risk. SharpSignal does not place bets for you and does not guarantee outcomes.
              Use conservative unit sizing and only bet what you can afford to lose.
            </p>
          </div>
        </section>
      </main>
    </>
  );
}

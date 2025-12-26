// pages/index.js (Next.js + Tailwind + Plausible + Lucide Icons)
import Head from "next/head";
import Script from "next/script";
import Link from "next/link";
import {
  Bot,
  MessageSquareText,
  Sparkles,
  Table as TableIcon,
  ShieldQuestion,
  Globe,
  Bell,
  BarChart2,
  Activity,
  Clock,
  Tag,
  BrainCircuit,
  LineChart,
  ArrowRight,
  Zap,
} from "lucide-react";

import { gaEvent } from "../lib/ga";

function track(action, category, label, value) {
  gaEvent({ action, category, label, value });
}

function RealtimeUpsellStrip() {
  const proCheckoutUrl =
    process.env.NEXT_PUBLIC_CHECKOUT_URL_STARTER ||
    process.env.NEXT_PUBLIC_CHECKOUT_URL_STARTER ||
    null;

  const telegramUrl = process.env.NEXT_PUBLIC_TELEGRAM_PRO_URL || null;

  return (
    <div className="mt-6 bg-white/10 border border-white/20 backdrop-blur rounded-2xl p-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            <Zap className="w-5 h-5 text-emerald-200" />
          </div>
          <div>
            <div className="font-semibold">Realtime Plays (Telegram)</div>
            <div className="text-sm text-white/85">
              Instant alerts when the edge triggers. <span className="font-semibold">$20/mo</span>. Cancel anytime.
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <a
            href={proCheckoutUrl || "/signup"}
            onClick={() => track("click_upgrade_realtime", "homepage", "realtime_strip_upgrade")}
            className="inline-flex items-center justify-center gap-2 bg-white text-indigo-700 px-5 py-2.5 rounded-xl font-bold hover:bg-white/95 transition"
          >
            Upgrade
            <ArrowRight className="w-4 h-4" />
          </a>

          <a
            href={telegramUrl || "#"}
            target="_blank"
            rel="noreferrer"
            onClick={() => track("click_join_telegram", "homepage", "realtime_strip_join")}
            className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold border ${
              telegramUrl
                ? "bg-white/10 border-white/30 hover:bg-white/15 text-white"
                : "bg-white/5 border-white/10 text-white/60 cursor-not-allowed"
            } transition`}
          >
            Join Telegram
          </a>
        </div>
      </div>
    </div>
  );
}

function HowItWorks() {
  return (
    <section className="container mx-auto px-6 py-16">
      <div className="text-center max-w-4xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">How it works</h2>
        <p className="text-lg text-gray-600">
          Simple funnel. Transparency first. Upgrade only when you want realtime speed.
        </p>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="bg-white rounded-2xl shadow p-6 border">
            <div className="text-xs font-semibold bg-emerald-50 text-emerald-700 inline-flex px-3 py-1 rounded-full border">
              Step 1
            </div>
            <h3 className="font-bold text-lg mt-3">Preview picks (free)</h3>
            <p className="text-sm text-gray-600 mt-2">
              See today’s picks and public proof (win rate + ROI). No account needed.
            </p>
            <div className="mt-4">
              <Link
                href="/picks-preview"
                onClick={() => track("click_view_picks", "homepage", "how_it_works_step1")}
                className="inline-flex items-center gap-2 text-indigo-700 font-semibold hover:underline"
              >
                Open preview <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow p-6 border">
            <div className="text-xs font-semibold bg-indigo-50 text-indigo-700 inline-flex px-3 py-1 rounded-full border">
              Step 2
            </div>
            <h3 className="font-bold text-lg mt-3">Unlock the dashboard</h3>
            <p className="text-sm text-gray-600 mt-2">
              Create a free account to access the full picks dashboard and filters.
            </p>
            <div className="mt-4">
              <Link
                href="/signup"
                onClick={() => track("click_signup_free", "homepage", "how_it_works_step2")}
                className="inline-flex items-center gap-2 text-indigo-700 font-semibold hover:underline"
              >
                Create free account <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow p-6 border">
            <div className="text-xs font-semibold bg-amber-50 text-amber-700 inline-flex px-3 py-1 rounded-full border">
              Step 3
            </div>
            <h3 className="font-bold text-lg mt-3">Upgrade for realtime</h3>
            <p className="text-sm text-gray-600 mt-2">
              Pro gets you instant Telegram alerts when the model triggers (no delay).
            </p>
            <div className="mt-4">
              <a
                href={process.env.NEXT_PUBLIC_CHECKOUT_URL_STARTER || process.env.NEXT_PUBLIC_CHECKOUT_URL_STARTER || "/signup"}
                onClick={() => track("click_upgrade_realtime", "homepage", "how_it_works_step3")}
                className="inline-flex items-center gap-2 text-indigo-700 font-semibold hover:underline"
              >
                Upgrade for realtime <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const enterpriseUrl = process.env.NEXT_PUBLIC_CHECKOUT_URL_STARTER;

  return (
    <>
      <Script src="https://cdn.tailwindcss.com" strategy="beforeInteractive" />
      <Head>
        <title>SharpSignal | Transparent Picks & Results</title>
        <meta
          name="description"
          content="Transparent, timestamped picks with publicly shown win rate and ROI. View today’s picks free."
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;800&display=swap"
          rel="stylesheet"
        />
        <style>{`body { font-family: 'Poppins', sans-serif; }`}</style>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* Plausible (kept as-is) */}
      <Script strategy="afterInteractive" src="https://plausible.io/js/plausible.js" data-domain="sharps-signal.com" />

      <main className="bg-gray-50 text-gray-800">
        {/* Hero */}
        <section id="hero" className="relative overflow-hidden text-white">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-indigo-600 to-blue-700" />
          <div className="absolute -top-24 -left-24 w-[40rem] h-[40rem] rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-40 -right-24 w-[45rem] h-[45rem] rounded-full bg-black/10 blur-3xl" />

          <div className="relative container mx-auto px-6 py-20 lg:py-28">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              {/* Copy */}
              <div>
                <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur px-3 py-1.5 rounded-full mb-4 border border-white/20">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-sm font-semibold">Transparent picks. Logged & graded.</span>
                </div>

                <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight drop-shadow-md">
                  +52% ROI across 1,800+ tracked bets
                </h1>

                <p className="mt-3 text-2xl font-semibold text-emerald-200">
                  Real odds. Real timestamps. No hype.
                </p>

                <p className="mt-4 text-lg text-white/90 max-w-xl">
                  SharpsSignal tracks sharp market movement across books and alerts when real edge appears.
                  Every pick is logged, timestamped, and graded publicly.
                </p>

                <div className="mt-8 flex flex-col sm:flex-row gap-4">
                  <Link
                    href="/picks-preview"
                    onClick={() => track("click_view_picks", "homepage", "hero_primary")}
                    className="inline-flex items-center justify-center gap-2 bg-white text-emerald-700 px-8 py-4 rounded-full font-bold text-lg shadow hover:shadow-xl transition"
                  >
                    View Today&apos;s Picks (Free)
                    <ArrowRight className="w-5 h-5" />
                  </Link>

                  <Link
                    href="/signup"
                    onClick={() => track("click_signup_free", "homepage", "hero_secondary")}
                    className="inline-flex items-center justify-center gap-2 bg-white/10 border border-white/30 px-8 py-4 rounded-full font-semibold text-lg hover:bg-white/15 transition"
                  >
                    Sign up free
                  </Link>
                </div>

                {/* NEW: realtime upsell strip */}
                <RealtimeUpsellStrip />

                <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/90">
                  <span className="inline-flex items-center gap-2">
                    <Activity className="w-4 h-4" /> Live market data
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Timestamped picks
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <BarChart2 className="w-4 h-4" /> ROI shown publicly
                  </span>
                </div>
              </div>

              {/* Proof panel */}
              <div className="relative">
                <div className="bg-white/10 backdrop-blur border border-white/20 rounded-3xl p-6 shadow-2xl">
                  <div className="flex items-center justify-between mb-4">
                    <div className="inline-flex items-center gap-2">
                      <TableIcon className="w-5 h-5" />
                      <span className="font-semibold">What you’ll see in the preview</span>
                    </div>
                    <span className="text-xs bg-white/10 border border-white/20 px-2 py-1 rounded-full">
                      Updated daily
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white rounded-2xl p-4 text-gray-900 shadow">
                      <div className="text-xs text-gray-500">Last 7 days</div>
                      <div className="text-2xl font-extrabold mt-1">Win rate</div>
                      <div className="text-sm text-gray-600">Shown on preview page</div>
                    </div>
                    <div className="bg-white rounded-2xl p-4 text-gray-900 shadow">
                      <div className="text-xs text-gray-500">Last 7 days</div>
                      <div className="text-2xl font-extrabold mt-1">ROI</div>
                      <div className="text-sm text-gray-600">Shown on preview page</div>
                    </div>
                    <div className="bg-white rounded-2xl p-4 text-gray-900 shadow">
                      <div className="text-xs text-gray-500">Trust signal</div>
                      <div className="text-2xl font-extrabold mt-1">Timestamp</div>
                      <div className="text-sm text-gray-600">When the model ran</div>
                    </div>
                  </div>

                  <div className="mt-5 bg-white/10 border border-white/15 rounded-2xl p-4">
                    <div className="text-sm font-semibold mb-2">Why this works</div>
                    <ul className="space-y-2 text-sm text-white/90">
                      <li className="flex items-start gap-2">
                        <ShieldQuestion className="w-4 h-4 mt-0.5" />
                        <span>Preview first. Sign up after you trust the data.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Bell className="w-4 h-4 mt-0.5" />
                        <span>Alerts fire when sharp movement + limits align.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <LineChart className="w-4 h-4 mt-0.5" />
                        <span>Realtime plays are optional — upgrade when you want speed.</span>
                      </li>
                    </ul>
                  </div>

                  <div className="mt-6">
                    <Link
                      href="/picks-preview"
                      onClick={() => track("click_view_picks", "homepage", "proof_panel_cta")}
                      className="inline-flex items-center justify-center w-full bg-white text-indigo-700 px-6 py-3 rounded-2xl font-bold hover:bg-white/95 transition"
                    >
                      View Today&apos;s Picks (Free)
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Link>
                    <p className="mt-2 text-xs text-white/70 text-center">No credit card. Just transparency.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <HowItWorks />

        {/* Machine Learning section */}
        <section className="container mx-auto px-6 py-16">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-full mb-4">
              <BrainCircuit className="w-5 h-5" />
              <span className="text-sm font-semibold">Behind the picks</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">
              Models + data pipelines built to stay honest
            </h2>
            <p className="text-lg text-gray-600">
              We track market movement, probability signals, and liquidity indicators — then log outcomes so the system
              stays accountable over time.
            </p>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl shadow p-6 border">
                <Activity className="w-6 h-6 text-indigo-600 mb-3" />
                <h3 className="font-bold text-lg">Live signals</h3>
                <p className="text-sm text-gray-600 mt-2">
                  Pulls live odds and movement to detect edge moments in real time.
                </p>
              </div>

              <div className="bg-white rounded-2xl shadow p-6 border">
                <BarChart2 className="w-6 h-6 text-indigo-600 mb-3" />
                <h3 className="font-bold text-lg">Graded results</h3>
                <p className="text-sm text-gray-600 mt-2">
                  Picks are logged and graded, so performance is visible — not vibes-based.
                </p>
              </div>

              <div className="bg-white rounded-2xl shadow p-6 border">
                <Clock className="w-6 h-6 text-indigo-600 mb-3" />
                <h3 className="font-bold text-lg">Timestamped runs</h3>
                <p className="text-sm text-gray-600 mt-2">
                  Every daily run has a timestamp so you can confirm freshness.
                </p>
              </div>
            </div>

            <div className="mt-10">
              <Link
                href="/picks-preview"
                onClick={() => track("click_view_picks", "homepage", "ml_section_cta")}
                className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white px-7 py-3 rounded-full font-semibold hover:bg-indigo-700 transition"
              >
                View Today&apos;s Picks (Free)
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="container mx-auto px-6 py-16">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">Plans</h2>
            <p className="text-lg text-gray-600">Start free. Upgrade when you’re ready for realtime.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Free */}
            <div className="border rounded-3xl p-8 shadow bg-white">
              <Tag className="text-blue-600 mb-4 mx-auto" />
              <h3 className="text-2xl font-semibold mb-2">Free</h3>
              <p className="text-gray-600 mb-6">Preview + proof</p>
              <ul className="space-y-3 text-sm text-gray-700 mb-8">
                <li className="flex items-center gap-3 bg-white">
                  <span className="w-2 h-2 rounded-full bg-blue-600" />
                  Picks preview
                </li>
                <li className="flex items-center gap-3 bg-white">
                  <span className="w-2 h-2 rounded-full bg-blue-600" />
                  ROI + win rate
                </li>
                <li className="flex items-center gap-3 bg-white">
                  <span className="w-2 h-2 rounded-full bg-blue-600" />
                  Timestamped model run
                </li>
              </ul>
              <div className="text-center">
                <Link
                  href="/signup"
                  onClick={() => track("click_signup_free", "homepage", "pricing_free")}
                  className="inline-block bg-blue-600 text-white px-6 py-3 rounded-full font-semibold hover:bg-blue-700 transition"
                >
                  Join Free
                </Link>
              </div>
            </div>

            {/* Pro */}
            <div className="relative border-2 border-indigo-600 rounded-3xl p-8 shadow-2xl transition bg-gradient-to-br from-indigo-50 to-white">
              <span className="absolute top-4 right-4 bg-indigo-600 text-white px-2 py-1 rounded-full text-sm">
                Most Popular
              </span>
              <Globe className="text-indigo-600 mb-4 mx-auto" />
              <h3 className="text-2xl font-semibold mb-2">Pro (Realtime Telegram)</h3>
              <p className="text-gray-600 mb-6">$20/mo — instant alerts</p>
              <ul className="space-y-3 text-sm text-gray-700 mb-8">
                <li className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-indigo-600" />
                  Full picks access
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-indigo-600" />
                  Realtime Telegram alerts
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-indigo-600" />
                  Filters + dashboards
                </li>
              </ul>

              <div className="text-center">
                <a
                  href={process.env.NEXT_PUBLIC_CHECKOUT_URL_STARTER || "/signup"}
                  onClick={() => track("click_upgrade_realtime", "homepage", "pricing_pro")}
                  className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-full font-semibold hover:bg-indigo-700 transition"
                >
                  Upgrade
                </a>
              </div>
            </div>

            {/* Enterprise */}
            <div className="border rounded-3xl p-8 shadow bg-white">
              <ShieldQuestion className="text-emerald-600 mb-4 mx-auto" />
              <h3 className="text-2xl font-semibold mb-2">Enterprise</h3>
              <p className="text-gray-600 mb-6">Custom feeds + integrations</p>
              <ul className="space-y-3 text-sm text-gray-700 mb-8">
                <li className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  Custom markets/models
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  Execution/integration options
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  Priority support
                </li>
              </ul>

              <div className="text-center">
                <Link
                  href={enterpriseUrl || "/signup"}
                  onClick={() => track("click_enterprise", "homepage", "pricing_enterprise")}
                  className="inline-block bg-emerald-600 text-white px-6 py-3 rounded-full font-semibold hover:bg-emerald-700 transition"
                >
                  Contact / Upgrade
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t bg-white">
          <div className="container mx-auto px-6 py-10 text-sm text-gray-600 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span>© {new Date().getFullYear()} SharpsSignal</span>
            <div className="flex items-center gap-5">
              <Link href="/picks-preview" className="hover:text-gray-900">
                Picks Preview
              </Link>
              <Link href="/assistant" className="hover:text-gray-900">
                Assistant
              </Link>
              <Link href="/signup" className="hover:text-gray-900">
                Sign up
              </Link>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}

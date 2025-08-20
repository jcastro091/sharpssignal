// pages/index.js (Next.js + Tailwind + Plausible + Lucide Icons)
import Head from 'next/head'
import Script from 'next/script'
import Link from 'next/link'
import {
  Globe,
  Bell,
  BarChart2,
  Activity,
  Clock,
  Tag,
  BrainCircuit,
  LineChart
} from 'lucide-react'

export default function Home() {
  // ENV: set NEXT_PUBLIC_CHECKOUT_URL_ENTERPRISE for the $20/mo plan
  const enterpriseUrl = process.env.NEXT_PUBLIC_CHECKOUT_URL_ENTERPRISE

  return (
    <>
      {/* Tailwind + Fonts + Analytics */}
      <Script src="https://cdn.tailwindcss.com" strategy="beforeInteractive" />
      <Head>
        <title>SharpSignal | AI-Powered Picks</title>
        <meta
          name="description"
          content="AI + Machine Learning picks for Sports, Stocks, FX & Commodities"
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

      {/* Plausible */}
      <Script
        strategy="afterInteractive"
        src="https://plausible.io/js/plausible.js"
        data-domain="sharps-signal.com"
      />

      <main className="bg-gray-50 text-gray-800">
        {/* Hero */}
        <section className="text-center py-24 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
          <div className="container mx-auto px-6">
            <h1 className="text-4xl sm:text-6xl font-extrabold mb-4 drop-shadow-lg">
              AI‑Powered Signals for Sports, Stocks &amp; FX
            </h1>
            <p className="text-lg sm:text-2xl mb-6 max-w-2xl mx-auto leading-relaxed">
              Real‑time alerts, transparent results, now enhanced with Machine Learning.
            </p>
            <p className="text-md sm:text-lg mb-8 max-w-xl mx-auto text-yellow-300 font-semibold">
              🚨 Limited Beta Access – Join Free & Start Winning
            </p>
            <div className="flex justify-center gap-3">
              <Link
                href="/join"
                className="inline-block bg-white text-blue-600 px-8 py-4 rounded-full shadow-lg font-semibold hover:shadow-xl transition"
              >
                Get Free Picks
              </Link>
              <Link
                href={enterpriseUrl || '/join'}
                className="inline-block bg-indigo-500 text-white px-8 py-4 rounded-full shadow-lg font-semibold hover:bg-indigo-600 transition"
              >
                All Bets ($20/mo)
              </Link>
            </div>
          </div>
        </section>

        {/* NEW: Machine Learning section */}
        <section className="container mx-auto px-6 py-16">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-full mb-4">
              <BrainCircuit className="w-5 h-5" />
              <span className="font-semibold">Now with Machine Learning</span>
            </div>
            <h2 className="text-3xl font-bold mb-4">
              Smarter Signals from Real Data
            </h2>
            <p className="text-gray-700">
              Our models learn from odds movement, betting limits, timing, and historical outcomes.
              Each alert includes a confidence cue and clear entry details—so you always know why
              a pick or trade matters.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <LineChart className="w-6 h-6 text-blue-600 mb-2" />
              <h4 className="font-semibold">Feature‑Rich Inputs</h4>
              <p className="text-sm text-gray-700">
                Opening/current/closing lines, reversals, time‑to‑start, market context.
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <BarChart2 className="w-6 h-6 text-indigo-600 mb-2" />
              <h4 className="font-semibold">Confidence & Transparency</h4>
              <p className="text-sm text-gray-700">
                We publish win rates, ROI, and weekly recaps. No cherry‑picking.
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <Bell className="w-6 h-6 text-purple-600 mb-2" />
              <h4 className="font-semibold">Real‑Time Alerts</h4>
              <p className="text-sm text-gray-700">
                Telegram alerts fire as soon as the edge is confirmed.
              </p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="container mx-auto px-6 py-10">
          <h2 className="text-3xl font-bold mb-8 text-center">How It Works</h2>
          <div className="flex flex-col sm:flex-row flex-wrap justify-center sm:justify-around items-center gap-6 sm:gap-10">
            {[
              { icon: <Tag className="text-blue-600" />, text: 'Pick a plan' },
              { icon: <Bell className="text-indigo-600" />, text: 'Get Telegram alerts' },
              { icon: <BarChart2 className="text-purple-600" />, text: 'Track results' },
              { icon: <Clock className="text-blue-600" />, text: 'Weekly recaps' }
            ].map((step, i) => (
              <div key={i} className="flex flex-col items-center text-center max-w-[140px] sm:max-w-xs">
                <div className="bg-white p-4 rounded-full shadow-md mb-4">{step.icon}</div>
                <p className="font-medium">{step.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* UPDATED: What a Pick Looks Like (Sports & Trades) */}
        <section className="bg-gray-100 py-16">
          <h2 className="text-3xl font-bold mb-6 text-center">What a Pick Looks Like</h2>
          <div className="container mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Sports Pick Card */}
            <div className="bg-white rounded-xl shadow-lg p-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold bg-blue-50 text-blue-700 px-3 py-1 rounded-full">
                  🏈 Sports Pick
                </span>
                <span className="text-indigo-600 font-bold">Total: 8.0</span>
              </div>
              <div className="text-sm">
                <p className="font-semibold">San Francisco Giants vs San Diego Padres</p>
                <p>🗓️ Game Time: Aug 19, 9:40 PM EDT</p>
                <p>💲 Movement: -106 → +100 → -113 (Down)</p>
                <p>🔧 Setup: Total Bet</p>
                <p>🧠 AI: 1.8% | 🧿 Pick: <span className="font-semibold">Under</span></p>
                <p className="text-xs text-gray-500">bet_id: T198C4DEC219–TOT–I9J4120</p>
              </div>
              <Link
                href="/dashboard"
                className="block text-center bg-indigo-600 text-white font-semibold py-2 rounded-full hover:bg-indigo-700 transition"
              >
                View in Dashboard
              </Link>
            </div>

            {/* Trade Alert Card */}
            <div className="bg-white rounded-xl shadow-lg p-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full">
                  📈 Trade Alert
                </span>
                <span className="text-emerald-700 font-bold">Long</span>
              </div>
              <div className="text-sm">
                <p className="font-semibold">Symbol: TSLA</p>
                <p>💡 Entry: 329.46 | 🛡️ SL: 329.70 | 🎯 TP: 334.06</p>
                <p>⏰ Time: 2025‑08‑15 11:59:12 AM EDT</p>
                <p>📐 RR: 1.25</p>
                <p>🏷️ Tag: <code className="bg-gray-100 px-1 rounded">setupPullback</code></p>
              </div>
              <Link
                href="/dashboard"
                className="block text-center bg-emerald-600 text-white font-semibold py-2 rounded-full hover:bg-emerald-700 transition"
              >
                View in Dashboard
              </Link>
            </div>
          </div>
        </section>

        {/* PRICING: Free Picks + All Bets ($20/mo) */}
        <section className="bg-white py-16">
          <div className="container mx-auto px-6 text-center">
            <h2 className="text-3xl font-bold mb-10">Pricing</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Free Picks */}
              <div className="border rounded-xl p-8 hover:shadow-xl transition bg-gradient-to-br from-blue-50 to-white">
                <Tag className="text-blue-600 mb-4 mx-auto" />
                <h3 className="text-2xl font-semibold mb-2">Free Picks</h3>
                <p className="text-xl font-bold mb-4">$0</p>
                <ul className="mb-6 space-y-2 text-gray-700">
                  <li>Weekly free picks</li>
                  <li>Telegram access (read‑only)</li>
                  <li>Weekly recap email</li>
                </ul>
                <Link
                  href="/join"
                  className="inline-block bg-blue-600 text-white px-6 py-3 rounded-full font-semibold hover:bg-blue-700 transition"
                >
                  Join Free
                </Link>
              </div>

              {/* All Bets (Enterprise) */}
              <div className="relative border-2 border-indigo-600 rounded-xl p-8 hover:shadow-2xl transition bg-gradient-to-br from-indigo-50 to-white">
                <span className="absolute top-4 right-4 bg-indigo-600 text-white px-2 py-1 rounded-full text-sm">
                  Best Value
                </span>
                <Globe className="text-indigo-600 mb-4 mx-auto" />
                <h3 className="text-2xl font-semibold mb-2">All Bets (Enterprise)</h3>
                <p className="text-xl font-bold mb-4">$20/mo</p>
                <ul className="mb-6 space-y-2 text-gray-700">
                  <li>All sports & trade alerts</li>
                  <li>Live dashboard & analytics</li>
                  <li>Priority support</li>
                </ul>
                <Link
                  href={enterpriseUrl || '/join'}
                  className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-full font-semibold hover:bg-indigo-700 transition"
                >
                  Subscribe
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Features & Benefits */}
        <section className="container mx-auto px-6 py-16">
          <h2 className="text-3xl font-bold mb-8 text-center">Features & Benefits</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div className="flex items-start space-x-4">
              <Activity className="text-blue-600 mt-1" />
              <div>
                <h4 className="font-semibold mb-1">Multi‑Market Coverage</h4>
                <p>Sports, equities, FX, commodities—all in one place.</p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <BarChart2 className="text-indigo-600 mt-1" />
              <div>
                <h4 className="font-semibold mb-1">Transparent Performance</h4>
                <p>Real‑time charts and historical data.</p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <Bell className="text-purple-600 mt-1" />
              <div>
                <h4 className="font-semibold mb-1">Custom Alerts</h4>
                <p>Push notifications timed to game start or market hours.</p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <Clock className="text-blue-600 mt-1" />
              <div>
                <h4 className="font-semibold mb-1">Weekly Deep Dives</h4>
                <p>Hand‑crafted summaries with key trends.</p>
              </div>
            </div>
          </div>
        </section>

        {/* NEW: Testimonial */}
        <section className="bg-indigo-50 py-16">
          <div className="container mx-auto px-6 max-w-4xl text-center">
            <h2 className="text-3xl font-bold mb-6">What Members Say</h2>
            <div className="bg-white rounded-2xl shadow p-8">
              <p className="text-lg leading-relaxed text-gray-800">
                “SharpsSignal has been incredibly impressive. The accuracy of their AI generated picks has consistently outperformed expectations, and their 
				professionalism sets them apart in a crowede space. Highly recommended for serious bettors looking of an edge.”
              </p>
              <div className="mt-4 font-semibold">— Phillip Ramones</div>
            </div>
            {/* If you want the exact quote from Phillips, send it and I'll drop it here verbatim. */}
          </div>
        </section>

        {/* FAQ (unchanged) */}
        <section className="container mx-auto px-6 py-16">
          <h2 className="text-3xl font-bold mb-6 text-center">Frequently Asked Questions</h2>
          <div className="space-y-4 max-w-3xl mx-auto">
            {[
              { q: '📊 What markets do you cover?', a: 'Sports (NFL, NBA, MLB, etc.), stocks, forex, and select commodities. More markets coming soon.' },
              { q: '⚡ How fast are alerts?', a: 'Within seconds of our AI models confirming a high-confidence setup. Alerts are pushed instantly via Telegram.' },
              { q: '📲 How do I receive alerts?', a: 'All alerts are sent via our private Telegram channel. You’ll get betting picks, trade signals, and updates in real-time.' },
              { q: '🎯 How do I know which bets or trades to take?', a: 'Each alert includes symbol/matchup, direction (e.g., LONG, UNDER), entry/odds, and a confidence cue.' },
              { q: '📈 How accurate is the system?', a: 'We publicly track performance with ROI charts, win rates, and filters by sport, tag, and confidence.' },
              { q: '📅 Where can I see past picks?', a: 'The dashboard shows all confirmed picks, results, and analytics with filters.' },
              { q: '🤖 Can I automate?', a: 'Yes — we offer webhook-compatible alerts. Tutorials coming soon.' },
              { q: '🚫 Can I cancel anytime?', a: 'Yes. No contracts. Cancel anytime.' },
              { q: '🎁 Is there a free plan?', a: 'Yes — get weekly free picks and recaps on the Free plan.' }
            ].map((item, i) => (
              <details key={i} className="border rounded-lg p-4 hover:shadow" open={i === 0}>
                <summary className="font-medium cursor-pointer">{item.q}</summary>
                <p className="mt-2 text-gray-700">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-gray-100 py-8">
          <div className="container mx-auto px-6 text-center space-y-2 text-sm text-gray-600">
            <Link href="mailto:SharpSignal@gmail.com" className="text-indigo-600 hover:underline">
              SharpSignal@gmail.com
            </Link>
            <p>© 2025 SharpSignal. All rights reserved.</p>
            <div className="space-x-4">
              <Link href="/about" className="text-indigo-600 hover:underline">About & Contact</Link>
              <Link href="/legal#terms" className="text-indigo-600 hover:underline">📜 Terms</Link>
              <Link href="/legal#privacy" className="text-indigo-600 hover:underline">🔐 Privacy</Link>
            </div>
          </div>
        </footer>
      </main>
    </>
  )
}

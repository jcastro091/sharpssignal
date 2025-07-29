// pages/index.js (Next.js + Tailwind + Plausible + Lucide Icons)
import Head from 'next/head'
import Script from 'next/script'
import {
   Globe,
   Bell,
   BarChart2,
   Activity,
   Clock,
   Tag,
   Star
 } from 'lucide-react'
 import Link from 'next/link'


export default function Home() {
  const starterUrl = process.env.NEXT_PUBLIC_CHECKOUT_URL_STARTER
  const proUrl = process.env.NEXT_PUBLIC_CHECKOUT_URL_PRO
  const enterpriseUrl = process.env.NEXT_PUBLIC_CHECKOUT_URL_ENTERPRISE
  

  return (
    <>
      {/* Tailwind + Fonts + Analytics */}
      <Script src="https://cdn.tailwindcss.com" strategy="beforeInteractive" />
      <Head>
        <title>SharpSignal | AI-Powered Picks</title>
        <meta name="description" content="AI-Powered Picks for Sports, Stocks, FX & Commodities" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;800&display=swap"
          rel="stylesheet"
        />
        <style>{`body { font-family: 'Poppins', sans-serif; }`}</style>
		<meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Script
        strategy="afterInteractive"
        src="https://plausible.io/js/plausible.js"
        data-domain="sharps-signal.com"
      />

      <main className="bg-gray-50 text-gray-800">
        {/* Hero Section */}
        <section className="text-center py-24 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
		<div className="container mx-auto px-6">

		</div>
		
		
		
          <div className="container mx-auto px-6">
			<h1 className="text-3xl sm:text-5xl md:text-7xl font-extrabold mb-4 sm:mb-6 drop-shadow-lg">
              AI-Powered Picks for Every Market
            </h1>
            <p className="text-lg md:text-2xl mb-8 max-w-3xl mx-auto leading-relaxed">
              Real-time Telegram alerts, an interactive dashboard, and weekly performance
              recaps—transparent, data-driven, and easy to follow.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link
                href={starterUrl}
                className="inline-block bg-white text-blue-600 px-8 py-4 rounded-full shadow-lg font-semibold hover:shadow-xl transition"
              >
                Starter — $29/mo
              </Link>
              <Link
                href={proUrl}
                className="inline-block bg-white text-indigo-600 px-8 py-4 rounded-full shadow-lg font-semibold hover:shadow-xl transition"
              >
                Pro — $59/mo
              </Link>
              <Link
                href={enterpriseUrl}
                className="inline-block bg-white text-purple-700 px-8 py-4 rounded-full shadow-lg font-semibold hover:shadow-xl transition"
              >
                Enterprise — $99/mo
              </Link>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="container mx-auto px-6 py-16">
          <h2 className="text-3xl font-bold mb-8 text-center">How It Works</h2>
		  <div className="flex flex-col sm:flex-row flex-wrap justify-center sm:justify-around items-center gap-6 sm:gap-10">
            {[
			  { icon: <Tag className="text-blue-600 text-2xl sm:text-3xl" />, text: 'Subscribe to your plan' },
              { icon: <Bell size={32} className="text-indigo-600" />, text: 'Get instant Telegram alerts' },
              { icon: <BarChart2 size={32} className="text-purple-600" />, text: 'Track on your dashboard' },
              { icon: <Clock size={32} className="text-blue-600" />, text: 'Receive weekly recap' }
            ].map((step, i) => (
			  <div key={i} className="flex flex-col items-center text-center max-w-[140px] sm:max-w-xs">
                <div className="bg-white p-4 rounded-full shadow-md mb-4">{step.icon}</div>
				<p className="font-medium text-base sm:text-lg">{step.text}</p>
              </div>
            ))}
          </div>
        </section>
		
		{/* Sample Pick Demo */}
		<section className="bg-gray-100 py-16">
		  <h2 className="text-3xl font-bold mb-6 text-center">What a Pick Looks Like</h2>
		  <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-6 space-y-4">
			{/* Header: market & odds */}
			<div className="flex justify-between items-center">
			  <span className="font-semibold text-lg">H2H Away Underdog</span>
			  <span className="text-indigo-600 font-bold text-xl">+200</span>
			</div>

			{/* Details */}
			<p><span className="font-medium">Game:</span> Raptors @ Warriors</p>
			<p><span className="font-medium">Game Time:</span> Apr 12, 7:00 PM EST</p>
			<p><span className="font-medium">Recommended Stake:</span> $50 (¼ Kelly)</p>

			{/* CTA */}
			<Link
			  href="/dashboard"
			  className="block text-center bg-indigo-600 text-white font-semibold py-2 rounded-full hover:bg-indigo-700 transition"
			>
			  See It on Your Dashboard
			</Link>
		  </div>
		</section>


        {/* Pricing Plans */}
        <section className="bg-white py-16">
          <div className="container mx-auto px-6 text-center">
            <h2 className="text-3xl font-bold mb-10">Pricing Plans</h2>
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {/* Starter */}
              <div className="border rounded-xl p-8 hover:shadow-xl transition bg-gradient-to-br from-blue-50 to-white">
                <Tag size={28} className="text-blue-600 mb-4 mx-auto" />
                <h3 className="text-2xl font-semibold mb-2">Starter</h3>
                <p className="text-xl font-bold mb-4">$29/mo</p>
                <ul className="mb-6 space-y-2">
                  <li>1 market</li>
                  <li>Basic alerts</li>
                  <li>Email reports</li>
                </ul>
                <Link
                  href={starterUrl}
                  className="inline-block bg-blue-600 text-white px-6 py-3 rounded-full font-semibold hover:bg-blue-700 transition"
                >
                  Subscribe
                </Link>
              </div>
              {/* Pro */}
              <div className="relative border-2 border-indigo-600 rounded-xl p-8 hover:shadow-2xl transition bg-gradient-to-br from-indigo-50 to-white">
                <span className="absolute top-4 right-4 bg-indigo-600 text-white px-2 py-1 rounded-full text-sm">
                  Most Popular
                </span>
                <Star size={28} className="text-indigo-600 mb-4 mx-auto" />
                <h3 className="text-2xl font-semibold mb-2">Pro</h3>
                <p className="text-xl font-bold mb-4">$59/mo</p>
                <ul className="mb-6 space-y-2">
                  <li>All markets</li>
                  <li>Priority alerts</li>
                  <li>Live chat support</li>
                </ul>
                <Link
                  href={proUrl}
                  className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-full font-semibold hover:bg-indigo-700 transition"
                >
                  Subscribe
                </Link>
              </div>
              {/* Enterprise */}
              <div className="border rounded-xl p-8 hover:shadow-xl transition bg-gradient-to-br from-purple-50 to-white">
                <Globe size={28} className="text-purple-600 mb-4 mx-auto" />
                <h3 className="text-2xl font-semibold mb-2">Enterprise</h3>
                <p className="text-xl font-bold mb-4">$99/mo</p>
                <ul className="mb-6 space-y-2">
                  <li>Dedicated manager</li>
                  <li>Custom signals</li>
                </ul>
                <Link
                  href={enterpriseUrl}
                  className="inline-block bg-purple-600 text-white px-6 py-3 rounded-full font-semibold hover:bg-purple-700 transition"
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
              <Activity size={24} className="text-blue-600 mt-1" />
              <div>
                <h4 className="font-semibold mb-1">Multi-Market Coverage</h4>
                <p>Sports, equities, FX, commodities—all in one place.</p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <BarChart2 size={24} className="text-indigo-600 mt-1" />
              <div>
                <h4 className="font-semibold mb-1">Transparent Performance</h4>
                <p>Real-time P&L charts and historical data.</p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <Bell size={24} className="text-purple-600 mt-1" />
              <div>
                <h4 className="font-semibold mb-1">Custom Alerts</h4>
                <p>Push notifications 15 minutes before market open or game start.</p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <Clock size={24} className="text-blue-600 mt-1" />
              <div>
                <h4 className="font-semibold mb-1">Weekly Deep Dives</h4>
                <p>Handcrafted reports highlighting key trends.</p>
              </div>
            </div>
          </div>
        </section>
		

		{/* FAQ */}
		<section className="container mx-auto px-6 py-16">
		  <h2 className="text-3xl font-bold mb-6 text-center">Frequently Asked Questions</h2>
		  <div className="space-y-4 max-w-3xl mx-auto">
			{[
			  { q: '📊 What markets do you cover?', a: 'Sports (NFL, NBA, MLB, etc.), stocks, forex, and select commodities. More markets coming soon.' },
			  { q: '⚡ How fast are alerts?', a: 'Within seconds of our AI models confirming a high-confidence setup. Alerts are pushed instantly via Telegram.' },
			  { q: '📲 How do I receive alerts?', a: 'All alerts are sent via our private Telegram channel. You’ll get betting picks, trade signals, and updates in real-time.' },
			  { q: '🎯 How do I know which bets or trades to take?', a: 'Each alert includes full details — symbol or matchup, direction (e.g., LONG, OVER), entry/odds, and confidence level (✅ High, 🟡 Medium, ⚪ Low).' },
			  { q: '🧠 What does confidence level mean?', a: 'It reflects the strength of the setup based on odds movement, limits, timing, and historical models. ✅ means high-quality edge, 🟡 is good but may carry more risk.' },
			  { q: '📈 How accurate is the system?', a: 'We publicly track performance with ROI charts, win rates, and filters by sport, tag, and confidence. Full transparency. No cherry-picking.' },
			  { q: '📅 Where can I see past picks?', a: 'Our dashboard shows all confirmed picks, results, and analytics. You can filter by sport, tag, or date to explore what’s working.' },
			  { q: '🤖 Can I automate my bets or trades?', a: 'Yes — if you\'re tech-savvy, we offer webhook-compatible alerts. Full automation tutorials coming soon.' },
			  { q: '🚫 Can I cancel anytime?', a: 'Yes. There are no contracts. You can cancel anytime and receive a prorated refund for unused time.' },
			  { q: '🎁 Is there a free trial?', a: 'Yes — the Pro plan includes a 7-day trial so you can test alerts and dashboard tools.' },
			  { q: '🙋 Do I need to be a pro bettor or trader to use this?', a: 'Not at all. We built SharpSignal for anyone who wants to follow smart signals and level up using data. You stay in control — we provide the edge.' },
			  { q: '🛟 How do I contact support?', a: 'You can reach us on Telegram, email, or via the in-dashboard support button. We respond fast and actually care.' }
			].map((item, i) => (
			  <details
				key={i}
				className="border rounded-lg p-4 hover:shadow"
				open={i === 0}
			  >
				<summary className="font-medium cursor-pointer">{item.q}</summary>
				<p className="mt-2 text-gray-700">{item.a}</p>
			  </details>
			))}
		  </div>
		</section>

		
		{/* Footer */}
		<footer className="bg-gray-100 py-8">
		  <div className="container mx-auto px-6 text-center space-y-2 text-sm text-gray-600">
			<Link href="mailto:support@sharpsignal.com" className="text-indigo-600 hover:underline">
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

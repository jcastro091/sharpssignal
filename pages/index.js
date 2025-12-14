// pages/index.js (Next.js + Tailwind + Plausible + Lucide Icons)
import Head from 'next/head'
import Script from 'next/script'
import Link from 'next/link'
import { Bot, MessageSquareText, Sparkles, Table as TableIcon, ShieldQuestion } from 'lucide-react'
import { useRouter } from 'next/router' // (safe even if unused on the homepage)

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
		{/* HERO — SharpsSignal Assistant */}
		<section id="hero" className="relative overflow-hidden text-white">
		  {/* bg */}
		  <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-indigo-600 to-blue-700" />
		  <div className="absolute -top-24 -left-24 w-[40rem] h-[40rem] rounded-full bg-white/10 blur-3xl" />
		  <div className="absolute -bottom-40 -right-24 w-[45rem] h-[45rem] rounded-full bg-black/10 blur-3xl" />

		  <div className="relative container mx-auto px-6 py-20 lg:py-28">
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
			  {/* Copy + CTAs */}
			  <div>
				<div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur px-3 py-1.5 rounded-full mb-4 border border-white/20">
				  <Bot className="w-4 h-4" />
				  <span className="text-sm font-semibold">Now Live: SharpsSignal Assistant</span>
				</div>

				<h1 className="text-4xl sm:text-5xl font-extrabold leading-tight drop-shadow-md">
				  Ask. Compare. Understand.
				  <span className="block text-emerald-200">Your AI for betting & markets.</span>
				</h1>

				<p className="mt-4 text-lg sm:text-xl text-white/90 max-w-xl">
				  The Assistant finds <span className="font-semibold">best odds</span> across books,
				  explains the <span className="font-semibold">why behind picks</span>, and gives
				  <span className="font-semibold"> matchup summaries</span>—fast, transparent, and easy.
				</p>

				{/* Feature list */}
				<ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
				  <li className="flex items-center gap-3 bg-white/10 border border-white/15 rounded-xl px-3 py-2">
					<TableIcon className="w-5 h-5 text-emerald-200" />
					<span className="text-sm">Best odds in seconds</span>
				  </li>
				  <li className="flex items-center gap-3 bg-white/10 border border-white/15 rounded-xl px-3 py-2">
					<MessageSquareText className="w-5 h-5 text-emerald-200" />
					<span className="text-sm">Pick explanations & movement</span>
				  </li>
				  <li className="flex items-center gap-3 bg-white/10 border border-white/15 rounded-xl px-3 py-2">
					<ShieldQuestion className="w-5 h-5 text-emerald-200" />
					<span className="text-sm">Quick matchup context</span>
				  </li>
				  <li className="flex items-center gap-3 bg-white/10 border border-white/15 rounded-xl px-3 py-2">
					<Sparkles className="w-5 h-5 text-emerald-200" />
					<span className="text-sm">Free to try • Pro for live</span>
				  </li>
				</ul>

				{/* CTAs */}
				<div className="mt-8 flex flex-wrap gap-3">
				  <Link
					href="/assistant"
					className="inline-flex items-center gap-2 bg-white text-emerald-700 px-6 py-3 rounded-full font-semibold shadow hover:shadow-lg transition"
				  >
					<Sparkles className="w-5 h-5" /> Try the Assistant
				  </Link>
				  <Link
					href="/subscribe"
					className="inline-flex items-center gap-2 bg-emerald-500/20 border border-white/30 text-white px-6 py-3 rounded-full font-semibold hover:bg-emerald-500/30 transition"
				  >
					Join Free
				  </Link>
				  <Link
					href={enterpriseUrl || '/subscribe'}
					className="inline-flex items-center gap-2 bg-indigo-500/30 border border-white/30 text-white px-6 py-3 rounded-full font-semibold hover:bg-indigo-500/40 transition"
				  >
					View Plans
				  </Link>
				</div>

				<p className="mt-3 text-xs text-white/80">
				  Nothing here is financial advice. Bet responsibly.
				</p>
			  </div>

			  {/* Visual: compact chat mock */}
			  <div className="relative">
				<div className="absolute -inset-6 bg-white/10 blur-2xl rounded-3xl" />
				<div className="relative bg-white text-gray-800 rounded-3xl shadow-2xl ring-1 ring-black/5 overflow-hidden">
				  {/* header */}
				  <div className="flex items-center justify-between px-5 py-3 border-b">
					<div className="flex items-center gap-2">
					  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
					  <span className="text-sm font-semibold">SharpsSignal Assistant</span>
					</div>
					<span className="text-xs text-gray-400">Live</span>
				  </div>

				  {/* body */}
				  <div className="p-5 space-y-4 bg-gray-50">
					{/* user */}
					<div className="flex justify-end">
					  <div className="max-w-[75%] bg-emerald-600 text-white rounded-2xl rounded-br-none px-4 py-3 text-sm shadow">
						best odds for yankees moneyline
					  </div>
					</div>

					{/* odds card */}
					<div className="flex">
					  <div className="w-full bg-white rounded-2xl rounded-tl-none px-4 py-4 text-sm shadow border">
						<div className="text-xs font-semibold text-gray-600 mb-1">Away @ Home — H2H</div>
						<div className="flex items-center justify-between">
						  <div className="text-gray-800 font-semibold">Best price for Selection</div>
						  <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-1 rounded">Odds shopping</span>
						</div>
						<div className="mt-3 border rounded-lg overflow-hidden">
						  <table className="w-full text-sm">
							<thead className="bg-gray-100">
							  <tr>
								<th className="text-left px-3 py-2 font-medium">Book</th>
								<th className="text-right px-3 py-2 font-medium">Price</th>
							  </tr>
							</thead>
							<tbody>
							  <tr className="border-t">
								<td className="px-3 py-2">FanDuel</td>
								<td className="px-3 py-2 text-right">-105</td>
							  </tr>
							  <tr className="border-t">
								<td className="px-3 py-2">DraftKings</td>
								<td className="px-3 py-2 text-right">-110</td>
							  </tr>
							</tbody>
						  </table>
						</div>
						<div className="mt-2 text-[11px] text-gray-500">Demo data for preview.</div>
					  </div>
					</div>

					{/* user */}
					<div className="flex justify-end">
					  <div className="max-w-[75%] bg-emerald-600 text-white rounded-2xl rounded-br-none px-4 py-3 text-sm shadow">
						explain today’s pick
					  </div>
					</div>

					{/* assistant */}
					<div className="flex">
					  <div className="max-w-[92%] bg-white rounded-2xl rounded-tl-none px-4 py-3 text-sm shadow border">
						<div className="font-semibold mb-1">Pick: Under 8.5 @ -110</div>
						<p className="text-gray-700">
						  Model edge + late reversal; limits steady. Movement:
						  <span className="font-mono"> -106 → +100 → -113</span>.
						</p>
					  </div>
					</div>
				  </div>
				</div>
			  </div>
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
		

		{/* How It Works (Assistant-first) */}
		<section className="container mx-auto px-6 py-16">
		  <h2 className="text-3xl font-bold mb-8 text-center">How It Works</h2>
		  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
			<div className="bg-white rounded-xl p-6 shadow-sm">
			  <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
				<Bot className="text-emerald-600" />
			  </div>
			  <h4 className="font-semibold mb-1">Ask the Assistant</h4>
			  <p className="text-sm text-gray-700">“best odds…”, “explain today’s pick”, or “matchup summary”.</p>
			</div>
			<div className="bg-white rounded-xl p-6 shadow-sm">
			  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center mb-3">
				<TableIcon className="text-blue-600" />
			  </div>
			  <h4 className="font-semibold mb-1">Compare & Decide</h4>
			  <p className="text-sm text-gray-700">See a live odds table and the “why” behind the pick.</p>
			</div>
			<div className="bg-white rounded-xl p-6 shadow-sm">
			  <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center mb-3">
				<Bell className="text-indigo-600" />
			  </div>
			  <h4 className="font-semibold mb-1">Get Real-Time Alerts</h4>
			  <p className="text-sm text-gray-700">Telegram + web. We ping you when edge appears.</p>
			</div>
			<div className="bg-white rounded-xl p-6 shadow-sm">
			  <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center mb-3">
				<BarChart2 className="text-purple-600" />
			  </div>
			  <h4 className="font-semibold mb-1">Track Results</h4>
			  <p className="text-sm text-gray-700">Dashboard, ROI charts, weekly recap—fully transparent.</p>
			</div>
		  </div>
		</section>


		{/* What a Pick Looks Like (Assistant + Odds) */}
		<section className="bg-gray-100 py-16">
		  <h2 className="text-3xl font-bold mb-6 text-center">What a Pick Looks Like</h2>
		  <div className="container mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-8">
			{/* AI Pick + Explanation */}
			<div className="bg-white rounded-xl shadow-lg p-6 space-y-3">
			  <div className="flex items-center justify-between">
				<span className="text-sm font-semibold bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full">
				  🤖 AI Pick
				</span>
				<span className="text-emerald-700 font-bold">Confidence: 74%</span>
			  </div>
			  <div className="text-sm">
				<p className="font-semibold">Chicago White Sox @ New York Yankees</p>
				<p>🧿 Pick: <span className="font-semibold">Under 8.5</span> @ -110</p>
				<p>💡 Why: Model edge + late reversal; limits steady.</p>
				<p>💲 Movement: <span className="font-mono">+222 → +222 → +200 (Down)</span></p>
				<p className="text-xs text-gray-500">bet_id: T199788F7A99-H2H-6FBC5D</p>
			  </div>
			  <Link
				href="/assistant?q=explain%20today%E2%80%99s%20pick"
				className="block text-center bg-emerald-600 text-white font-semibold py-2 rounded-full hover:bg-emerald-700 transition"
			  >
				Ask the Assistant
			  </Link>
			</div>

			{/* Odds Shopping card */}
			<div className="bg-white rounded-xl shadow-lg p-6">
			  <div className="flex items-center justify-between">
				<span className="text-sm font-semibold bg-blue-50 text-blue-700 px-3 py-1 rounded-full">
				  📊 Odds Shopping
				</span>
				<span className="text-gray-700 font-semibold">H2H — Best Price</span>
			  </div>
			  <div className="mt-4 border rounded-lg overflow-hidden">
				<table className="w-full text-sm">
				  <thead className="bg-gray-100">
					<tr>
					  <th className="text-left px-3 py-2 font-medium">Book</th>
					  <th className="text-right px-3 py-2 font-medium">Price</th>
					</tr>
				  </thead>
				  <tbody>
					<tr className="border-t">
					  <td className="px-3 py-2">FanDuel</td>
					  <td className="px-3 py-2 text-right">-105</td>
					</tr>
					<tr className="border-t">
					  <td className="px-3 py-2">DraftKings</td>
					  <td className="px-3 py-2 text-right">-110</td>
					</tr>
				  </tbody>
				</table>
			  </div>
			  <p className="mt-2 text-xs text-gray-500">Demo data for preview. Try it live in the Assistant.</p>
			  <Link
				href="/assistant?q=best%20odds%20for%20yankees%20moneyline"
				className="mt-3 block text-center bg-indigo-600 text-white font-semibold py-2 rounded-full hover:bg-indigo-700 transition"
			  >
				Find Best Odds
			  </Link>
			</div>
		  </div>
		</section>


		{/* PRICING: Free vs Pro */}
		<section className="bg-white py-16">
		  <div className="container mx-auto px-6 text-center">
			<h2 className="text-3xl font-bold mb-10">Pricing</h2>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
			  {/* Free */}
			  <div className="border rounded-xl p-8 hover:shadow-xl transition bg-gradient-to-br from-blue-50 to-white">
				<Tag className="text-blue-600 mb-4 mx-auto" />
				<h3 className="text-2xl font-semibold mb-2">Free</h3>
				<p className="text-xl font-bold mb-4">$0</p>
				<ul className="mb-6 space-y-2 text-gray-700">
				  <li>Ask the Assistant (limited)</li>
				  <li>Weekly free picks</li>
				  <li>Email/Telegram recap</li>
				</ul>
				<Link
				  href="/join"
				  className="inline-block bg-blue-600 text-white px-6 py-3 rounded-full font-semibold hover:bg-blue-700 transition"
				>
				  Join Free
				</Link>
			  </div>

			  {/* Pro */}
			  <div className="relative border-2 border-indigo-600 rounded-xl p-8 hover:shadow-2xl transition bg-gradient-to-br from-indigo-50 to-white">
				<span className="absolute top-4 right-4 bg-indigo-600 text-white px-2 py-1 rounded-full text-sm">
				  Most Popular
				</span>
				<Globe className="text-indigo-600 mb-4 mx-auto" />
				<h3 className="text-2xl font-semibold mb-2">Pro (All Bets)</h3>
				<p className="text-xl font-bold mb-4">$20/mo</p>
				<ul className="mb-6 space-y-2 text-gray-700">
				  <li>Unlimited Assistant + live odds shopping</li>
				  <li>All sports & trade alerts (real-time)</li>
				  <li>Dashboard, history & analytics</li>
				  <li>Priority support</li>
				</ul>
				<Link
				  href={enterpriseUrl || '/subscribe'}
				  className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-full font-semibold hover:bg-indigo-700 transition"
				>
				  Upgrade to Pro
				</Link>
			  </div>
			</div>
			<p className="mt-4 text-xs text-gray-500">Cancel anytime. No contracts.</p>
		  </div>
		</section>

		{/* Features & Benefits (LLM-centric) */}
		<section className="container mx-auto px-6 py-16">
		  <h2 className="text-3xl font-bold mb-8 text-center">Features & Benefits</h2>
		  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
			<div className="flex items-start space-x-4">
			  <TableIcon className="text-emerald-600 mt-1" />
			  <div>
				<h4 className="font-semibold mb-1">Best-Odds Engine</h4>
				<p>Shop prices across books instantly—no tab hunting.</p>
			  </div>
			</div>
			<div className="flex items-start space-x-4">
			  <MessageSquareText className="text-indigo-600 mt-1" />
			  <div>
				<h4 className="font-semibold mb-1">Explainable Picks</h4>
				<p>We show movement, context, and the model’s reasoning.</p>
			  </div>
			</div>
			<div className="flex items-start space-x-4">
			  <ShieldQuestion className="text-blue-600 mt-1" />
			  <div>
				<h4 className="font-semibold mb-1">Matchup Summaries</h4>
				<p>Injuries, timing, weather (where available) at a glance.</p>
			  </div>
			</div>
			<div className="flex items-start space-x-4">
			  <BarChart2 className="text-purple-600 mt-1" />
			  <div>
				<h4 className="font-semibold mb-1">Transparent Results</h4>
				<p>ROI & win-rate charts with weekly recaps—no cherry-picking.</p>
			  </div>
			</div>
			<div className="flex items-start space-x-4">
			  <Activity className="text-emerald-600 mt-1" />
			  <div>
				<h4 className="font-semibold mb-1">Multi-Market Coverage</h4>
				<p>Sports, equities, FX, and more—one place to monitor.</p>
			  </div>
			</div>
			<div className="flex items-start space-x-4">
			  <Bell className="text-indigo-600 mt-1" />
			  <div>
				<h4 className="font-semibold mb-1">Real-Time Alerts</h4>
				<p>Telegram + web; get pinged when the edge appears.</p>
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

		{/* FAQ (revamped) */}
		<section className="relative py-20">
		  {/* subtle bg wash */}
		  <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-emerald-50/50 via-indigo-50/40 to-transparent" />

		  <div className="relative container mx-auto px-6">
			<div className="text-center max-w-2xl mx-auto mb-10">
			  <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full mb-4 border border-emerald-200/70">
				<ShieldQuestion className="w-4 h-4" />
				<span className="text-sm font-semibold">FAQ</span>
			  </div>
			  <h2 className="text-3xl md:text-4xl font-extrabold mb-3">Frequently Asked Questions</h2>
			  <p className="text-gray-600">
				Quick answers about the Assistant, pricing, and our signals.
			  </p>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-5xl mx-auto">
			  {[
				{
				  q: 'What markets do you cover?',
				  a: 'Sports (NFL, NBA, MLB, etc.), plus equities, FX and select commodities. Coverage expands as we add feeds.',
				  icon: <Globe className="w-5 h-5 text-emerald-600" />,
				},
				{
				  q: 'How fast are alerts?',
				  a: 'Within seconds of our models confirming an edge. We post to Telegram and the web dashboard immediately.',
				  icon: <Bell className="w-5 h-5 text-indigo-600" />,
				},
				{
				  q: 'How do I receive alerts?',
				  a: 'Join the private Telegram channel from your account. You’ll also see everything in the live dashboard.',
				  icon: <MessageSquareText className="w-5 h-5 text-blue-600" />,
				},
				{
				  q: 'How do I know which bets or trades to take?',
				  a: 'Each alert includes matchup/symbol, side (e.g., UNDER, LONG), entry/odds, confidence cue, and brief reasoning.',
				  icon: <TableIcon className="w-5 h-5 text-emerald-600" />,
				},
				{
				  q: 'How accurate is the system?',
				  a: 'We publish ROI, win rate, and weekly recaps. No cherry-picking—results are tracked transparently over time.',
				  icon: <BarChart2 className="w-5 h-5 text-purple-600" />,
				},
				{
				  q: 'Where can I see past picks?',
				  a: 'The dashboard keeps full history with filters by sport, tag, confidence, and result.',
				  icon: <Clock className="w-5 h-5 text-blue-600" />,
				},
				{
				  q: 'Can I automate?',
				  a: 'Yes. We offer webhook-compatible alerts so you can build your own automations. Guides are rolling out.',
				  icon: <Activity className="w-5 h-5 text-emerald-600" />,
				},
				{
				  q: 'Can I cancel anytime?',
				  a: 'Absolutely. No contracts. Manage your plan from your account settings.',
				  icon: <ShieldQuestion className="w-5 h-5 text-indigo-600" />,
				},
				{
				  q: 'Is there a free plan?',
				  a: 'Yes—use the Assistant with limits and get weekly free picks & recaps. Pro unlocks everything live.',
				  icon: <BrainCircuit className="w-5 h-5 text-blue-600" />,
				},
			  ].map((item, i) => (
				<details
				  key={i}
				  className="group bg-white/90 backdrop-blur border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition"
				  {...(i === 0 ? { open: true } : {})}
				>
				  <summary className="list-none flex items-start gap-3 cursor-pointer select-none">
					<div className="mt-0.5 shrink-0">{item.icon}</div>
					<div className="flex-1">
					  <div className="flex items-center justify-between">
						<h3 className="font-semibold text-gray-900">{item.q}</h3>
						{/* chevron */}
						<svg
						  className="w-5 h-5 text-gray-400 transition-transform group-open:rotate-180"
						  viewBox="0 0 24 24"
						  fill="none"
						  stroke="currentColor"
						  strokeWidth="2"
						  strokeLinecap="round"
						  strokeLinejoin="round"
						>
						  <polyline points="6 9 12 15 18 9" />
						</svg>
					  </div>
					</div>
				  </summary>
				  <div className="pl-9 pr-1 mt-3 text-gray-700 leading-relaxed">
					<p>{item.a}</p>
				  </div>
				</details>
			  ))}
			</div>

			{/* helpful links */}
			<div className="text-center mt-10">
			  <div className="inline-flex flex-wrap gap-3">
				<Link
				  href="/assistant"
				  className="inline-flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-full font-semibold hover:bg-emerald-700 transition shadow"
				>
				  <Bot className="w-4 h-4" /> Ask the Assistant
				</Link>
				<Link
				  href="/subscribe"
				  className="inline-flex items-center gap-2 bg-white border border-gray-300 text-gray-800 px-5 py-2.5 rounded-full font-semibold hover:bg-gray-50 transition"
				>
				  View Plans
				</Link>
				<Link
				  href="/legal#privacy"
				  className="inline-flex items-center gap-2 bg-white/70 border border-gray-200 text-gray-700 px-5 py-2.5 rounded-full font-semibold hover:bg-white transition"
				>
				  Privacy
				</Link>
			  </div>
			  <p className="mt-3 text-xs text-gray-500">
				Nothing here is financial advice. Bet responsibly.
			  </p>
			</div>
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

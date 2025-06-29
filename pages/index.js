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
            <h1 className="text-5xl md:text-7xl font-extrabold mb-6 drop-shadow-lg">
              AI-Powered Picks for Every Market
            </h1>
            <p className="text-lg md:text-2xl mb-8 max-w-3xl mx-auto leading-relaxed">
              Real-time Telegram alerts, an interactive dashboard, and weekly performance
              recaps—transparent, data-driven, and easy to follow.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <a
                href={starterUrl}
                className="inline-block bg-white text-blue-600 px-8 py-4 rounded-full shadow-lg font-semibold hover:shadow-xl transition"
              >
                Starter — $29/mo
              </a>
              <a
                href={proUrl}
                className="inline-block bg-white text-indigo-600 px-8 py-4 rounded-full shadow-lg font-semibold hover:shadow-xl transition"
              >
                Pro — $59/mo
              </a>
              <a
                href={enterpriseUrl}
                className="inline-block bg-white text-purple-700 px-8 py-4 rounded-full shadow-lg font-semibold hover:shadow-xl transition"
              >
                Enterprise — $99/mo
              </a>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="container mx-auto px-6 py-16">
          <h2 className="text-3xl font-bold mb-8 text-center">How It Works</h2>
          <div className="flex flex-col md:flex-row justify-around items-start gap-10">
            {[
              { icon: <Tag size={32} className="text-blue-600" />, text: 'Subscribe to your plan' },
              { icon: <Bell size={32} className="text-indigo-600" />, text: 'Get instant Telegram alerts' },
              { icon: <BarChart2 size={32} className="text-purple-600" />, text: 'Track on your dashboard' },
              { icon: <Clock size={32} className="text-blue-600" />, text: 'Receive weekly recaps' }
            ].map((step, i) => (
              <div key={i} className="flex flex-col items-center text-center max-w-xs">
                <div className="bg-white p-4 rounded-full shadow-md mb-4">{step.icon}</div>
                <p className="font-medium text-lg">{step.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing Plans */}
        <section className="bg-white py-16">
          <div className="container mx-auto px-6 text-center">
            <h2 className="text-3xl font-bold mb-10">Pricing Plans</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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
                <a
                  href={starterUrl}
                  className="inline-block bg-blue-600 text-white px-6 py-3 rounded-full font-semibold hover:bg-blue-700 transition"
                >
                  Subscribe
                </a>
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
                <a
                  href={proUrl}
                  className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-full font-semibold hover:bg-indigo-700 transition"
                >
                  Subscribe
                </a>
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
                <a
                  href={enterpriseUrl}
                  className="inline-block bg-purple-600 text-white px-6 py-3 rounded-full font-semibold hover:bg-purple-700 transition"
                >
                  Subscribe
                </a>
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

        {/* Testimonials */}
        <section className="bg-indigo-50 py-16">
          <div className="container mx-auto px-6 text-center">
            <h2 className="text-3xl font-bold mb-8">What Our Subscribers Say</h2>
            <div className="space-y-8 max-w-2xl mx-auto">
              <blockquote className="italic text-lg">
                “Game changer—up 18% this month alone!”
                <footer className="mt-2 font-semibold">— Alex P.</footer>
              </blockquote>
              <blockquote className="italic text-lg">
                “Saved me countless hours of analysis.”
                <footer className="mt-2 font-semibold">— Maria L.</footer>
              </blockquote>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="container mx-auto px-6 py-16">
          <h2 className="text-3xl font-bold mb-6 text-center">Frequently Asked Questions</h2>
          <div className="space-y-4 max-w-3xl mx-auto">
            {[
              { q: 'What markets do you cover?', a: 'Sports, stocks, FX, commodities.' },
              { q: 'How fast are alerts?', a: 'Within seconds of AI signal generation.' },
              { q: 'Cancel anytime?', a: 'Yes—no contracts and prorated refunds.' },
              { q: 'Free trial?', a: '7-day trial on Pro plan.' }
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
            <a href="mailto:support@sharpsignal.com" className="text-indigo-600 hover:underline">
              support@sharpsignal.com
            </a>
            <p>© 2025 SharpSignal. All rights reserved.</p>
          </div>
        </footer>
      </main>
    </>
  )
}

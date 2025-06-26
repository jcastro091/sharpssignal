// pages/index.js (React + Tailwind via CDN fallback)
import Head from 'next/head'

export default function Home() {
  return (
    <>
      <Head>
        <title>SharpSignal | AI-Powered Picks</title>
        <meta name="description" content="AI-Powered Picks for Sports, Stocks, FX & Commodities" />
        {/* Fallback via CDN to ensure Tailwind is loaded */}
        <script src="https://cdn.tailwindcss.com"></script>
      </Head>

      <main className="container mx-auto px-4 py-8 space-y-16">
        <Hero />
        <Stats />
        <HowItWorks />
        <Features />
        <Pricing />
        <Testimonials />
        <FAQ />
        <Footer />
      </main>
    </>
  )
}

// HERO with gradient background
function Hero() {
  return (
    <section className="text-center py-20 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
      <h1 className="text-5xl md:text-6xl font-extrabold mb-6">
        AI-Powered Picks for Every Market
      </h1>
      <p className="text-xl md:text-2xl mb-8 max-w-2xl mx-auto">
        Real-time Telegram alerts, an interactive dashboard, and weekly performance recaps—transparent, data-driven, and easy to follow.
      </p>
      <a
        href="https://your-subscription-link.com"
        className="inline-block bg-white text-blue-600 px-8 py-4 rounded-full shadow-lg font-semibold hover:shadow-xl transition"
      >
        Start Your Free Trial
      </a>
    </section>
  )
}

// STATS cards with shadow
function Stats() {
  const items = [
    { label: 'Winning Rate (30d)', value: '87%' },
    { label: 'Avg. Monthly ROI', value: '+24%' },
    { label: 'Active Subscribers', value: '1000+' },
  ]
  return (
    <section className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
      {items.map(({ label, value }) => (
        <div key={label} className="border rounded-lg p-6 shadow-lg hover:shadow-2xl transition">
          <p className="text-3xl font-bold">{value}</p>
          <p className="text-gray-700 mt-2">{label}</p>
        </div>
      ))}
    </section>
  )
}

// HOW IT WORKS section
function HowItWorks() {
  const steps = [
    'Subscribe and choose your plan',
    'Join our Telegram channel for instant alerts',
    'Track every pick on your dashboard',
    'Receive weekly performance recaps',
  ]
  return (
    <section className="px-4">
      <h2 className="text-2xl font-bold mb-4">How It Works</h2>
      <ol className="list-decimal list-inside space-y-2 text-gray-700 max-w-xl mx-auto">
        {steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
    </section>
  )
}

// FEATURES with icons
function Features() {
  const features = [
    { icon: '⚽️', title: 'Multi-Market Coverage', desc: 'Sports, equities, FX, commodities—all in one place.' },
    { icon: '📊', title: 'Transparent Performance', desc: 'Real-time P&L charts and historical data.' },
    { icon: '🔔', title: 'Custom Alerts', desc: 'Push notifications 15 min before market open or game start.' },
    { icon: '📈', title: 'Weekly Deep Dives', desc: 'Handcrafted reports highlighting key trends.' },
  ]
  return (
    <section className="px-4">
      <h2 className="text-2xl font-bold mb-4">Features & Benefits</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {features.map(({ icon, title, desc }) => (
          <div key={title} className="p-6 border rounded-lg text-left">
            <div className="text-4xl mb-2">{icon}</div>
            <h3 className="font-semibold mb-1">{title}</h3>
            <p className="text-gray-600">{desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

// PRICING cards
function Pricing() {
  const plans = [
    { name: 'Starter', price: '$29/mo', features: ['1 market', 'Basic alerts', 'Email reports'], popular: false },
    { name: 'Pro', price: '$59/mo', features: ['All markets', 'Priority alerts', 'Live chat'], popular: true },
    { name: 'Enterprise', price: '$99/mo', features: ['Dedicated manager', 'Custom signals'], popular: false },
  ]
  return (
    <section className="px-4">
      <h2 className="text-2xl font-bold mb-4">Pricing Plans</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map(plan => (
          <div key={plan.name} className={`p-6 rounded-lg ${plan.popular ? 'border-4 border-blue-600 bg-blue-50' : 'border'} shadow-lg`}>`
            {plan.popular && <div className="text-blue-600 uppercase text-sm mb-2">Most Popular</div>}
            <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
            <p className="text-2xl font-bold mb-4">{plan.price}</p>
            <ul className="space-y-1 mb-4 text-gray-600">
              {plan.features.map(f => <li key={f}>• {f}</li>)}
            </ul>
            <a href="https://your-subscription-link.com" className="block text-center bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">Subscribe</a>
          </div>
        ))}
      </div>
    </section>
  )
}

// TESTIMONIALS
function Testimonials() {
  const quotes = [
    { text: 'Game changer—up 18% this month alone!', author: 'Alex P.' },
    { text: 'Saved me countless hours of analysis.', author: 'Maria L.' },
  ]
  return (
    <section className="px-4">
      <h2 className="text-2xl font-bold mb-4">What Our Subscribers Say</h2>
      <div className="space-y-6 max-w-2xl mx-auto">
        {quotes.map((q, i) => (
          <blockquote key={i} className="border-l-4 pl-4 italic text-gray-700">
            “{q.text}”
            <footer className="mt-2 font-semibold">— {q.author}</footer>
          </blockquote>
        ))}
      </div>
    </section>
  )
}

// FAQ
function FAQ() {
  const faqs = [
    { q: 'What markets do you cover?', a: 'Sports, stocks, FX, commodities' },
    { q: 'How fast are alerts?', a: 'Within seconds of AI signal generation' },
    { q: 'Cancel anytime?', a: 'Yes—no contracts and prorated refunds' },
    { q: 'Free trial?', a: '7-day trial on Pro plan' },
  ]
  return (
    <section className="px-4">
      <h2 className="text-2xl font-bold mb-4">Frequently Asked Questions</h2>
      <dl className="space-y-4 max-w-xl mx-auto">
        {faqs.map((f, i) => (
          <div key={i}>
            <dt className="font-semibold">{f.q}</dt>
            <dd className="text-gray-600 ml-4">{f.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

// FOOTER
function Footer() {
  return (
    <footer className="text-center py-8 border-t">
      <p className="mb-4">Ready to get started?</p>
      <a href="https://your-subscription-link.com" className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700">Subscribe Now</a>
      <div className="mt-6 text-sm text-gray-500">
        <p>Contact us: support@sharpsignal.com</p>
        <p>© {new Date().getFullYear()} SharpSignal. All rights reserved.</p>
      </div>
    </footer>
  )
}

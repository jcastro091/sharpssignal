// pages/about.js
import Head from 'next/head'
import { Lightbulb, BarChart2, Globe } from 'lucide-react'
import Link from 'next/link'

export default function About() {
  return (
    <>
      <Head>
        <title>About | SharpSignal</title>
        <meta
          name="description"
          content="Learn more about SharpSignal—our mission, story, and how to get in touch."
        />
      </Head>

      {/* Hero Banner */}
      <section className="bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 text-white py-24">
        <div className="container mx-auto px-6 text-center">
          <h1 className="text-5xl font-extrabold mb-4 drop-shadow-lg">About SharpSignal</h1>
          <p className="text-lg max-w-2xl mx-auto leading-relaxed opacity-90">
            Demystifying market data with AI-powered picks for sports, stocks, FX, and commodities—
            transparent, data-driven, and always in your pocket.
          </p>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="container mx-auto px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-2 items-center">
          <div>
            <h2 className="text-3xl font-bold mb-4">Our Mission</h2>
            <p className="mb-6 text-gray-700 leading-relaxed">
              At <strong>SharpSignal</strong>, we deliver AI-powered trading and betting picks you can trust.
              Founded by quant traders and data scientists, our platform blends real-time alerts with
              transparent performance tracking—so you always know exactly where you stand.
            </p>
            <h2 className="text-3xl font-bold mb-4">Our Vision</h2>
            <p className="text-gray-700 leading-relaxed">
              We believe in full transparency and data-driven decision-making. Whether you’re into
              sports, stocks, FX, or commodities, our engine continuously scans for edge and delivers
              it to your device instantly.
            </p>
          </div>
          {/* Illustration placeholder */}
          <div className="bg-indigo-50 rounded-lg h-64 lg:h-auto flex items-center justify-center">
            <span className="text-indigo-300 italic">[Your Illustration Here]</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-100 py-16">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-12">Why SharpSignal?</h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[{
              icon: <Lightbulb className="w-8 h-8 text-indigo-600" />,
              title: 'Smart Insights',
              desc: 'AI-driven signals you can rely on, across every market.'
            },{
              icon: <BarChart2 className="w-8 h-8 text-indigo-600" />,
              title: 'Transparent Performance',
              desc: 'Real-time P&L charts and detailed historical recaps.'
            },{
              icon: <Globe className="w-8 h-8 text-indigo-600" />,
              title: 'Global Coverage',
              desc: 'Sports, equities, FX, commodities — we’ve got you covered.'
            }].map((feat, i) => (
              <div
                key={i}
                className="bg-white p-6 rounded-2xl shadow hover:shadow-lg transition"
              >
                <div className="mb-4 inline-flex rounded-full bg-indigo-100 p-3">
                  {feat.icon}
                </div>
                <h3 className="text-xl font-semibold mb-2">{feat.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Get in Touch */}
      <section className="bg-indigo-600 text-white py-16">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">Get in Touch</h2>
          <p className="mb-6 leading-relaxed max-w-xl mx-auto">
            Questions, feedback, or support inquiries? Drop us a line or hop on live chat any time.
          </p>
          <div className="inline-flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="mailto:SharpsSignal@gmail.com"
              className="inline-block bg-white text-indigo-600 px-8 py-3 rounded-full font-semibold hover:bg-gray-100 transition"
            >
              Email Us
            </a>
            <Link
              href="/contact"
              className="inline-block bg-indigo-800 text-white px-8 py-3 rounded-full font-semibold hover:bg-indigo-900 transition"
            >
              Live Chat
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}

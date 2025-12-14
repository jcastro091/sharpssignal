// pages/contact.js
import Head from 'next/head'
import { Mail, Phone } from 'lucide-react'

export default function Contact() {
  return (
    <>
      <Head>…</Head>
      {/* Hero Banner */}
      <section>…</section>

      {/* Content */}
      <section className="container mx-auto px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-2 items-start">
          {/* Contact Info */}
          <div className="space-y-8">
            <div className="flex items-center space-x-4">
              <div className="p-3 rounded-full bg-indigo-50 text-indigo-600">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">Email Support</h3>
                <a href="mailto:SharpsSignal@gmail.com" className="text-indigo-600 hover:underline">
                  SharpsSignal@gmail.com
                </a>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="p-3 rounded-full bg-indigo-50 text-indigo-600">
                <Phone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">Call Us</h3>
                <a href="tel:+1234567890" className="text-indigo-600 hover:underline">
                  +1 (234) 567-890
                </a>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <form name="contact" method="POST" data-netlify="true" className="space-y-6 bg-white p-8 rounded-2xl shadow-lg">
            <input type="hidden" name="form-name" value="contact" />
            {/* name, email, message fields… */}
            <button type="submit" className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-lg hover:bg-indigo-700 transition">
              Send Message
            </button>
          </form>
        </div>
      </section>
    </>
  )
}

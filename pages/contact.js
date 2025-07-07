// pages/contact.js
import Head from 'next/head'
import { Mail, Phone, MessageSquare } from 'lucide-react'
import Link from "next/link"

export default function Contact() {
  return (
    <>
      <Head>
        <title>Contact | SharpSignal</title>
        <meta
          name="description"
          content="Get in touch with SharpSignal for support, feedback, or partnership inquiries."
        />
      </Head>

      {/* Hero Banner */}
      <section className="bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 text-white py-20">
        <div className="container mx-auto px-6 text-center">
          <h1 className="text-5xl font-extrabold mb-4 drop-shadow-lg">Contact Us</h1>
          <p className="text-lg max-w-2xl mx-auto opacity-90">
            Have questions, feedback, or need help? Fill out the form below or reach us directly—and
            we’ll get back to you within 24 hours.
          </p>
        </div>
      </section>

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
                <a
                  href="mailto:SharpsSignal@gmail.com"
                  className="text-indigo-600 hover:underline"
                >
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
          <form
            name="contact"
            method="POST"
            data-netlify="true"
            className="space-y-6 bg-white p-8 rounded-2xl shadow-lg"
          >
            {/* Netlify form hidden input */}
            <input type="hidden" name="form-name" value="contact" />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your Name
              </label>
              <input
                type="text"
                name="name"
                required
                className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                name="email"
                required
                className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Message
              </label>
              <textarea
                name="message"
                rows="5"
                required
                className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
              ></textarea>
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-lg hover:bg-indigo-700 transition"
            >
              Send Message
            </button>
          </form>
        </div>
      </section>
    </>
  )
}

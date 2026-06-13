import Head from "next/head";
import Link from "next/link";
import { Mail, MessageSquareText } from "lucide-react";

export default function Contact() {
  return (
    <>
      <Head>
        <title>Contact | SharpSignal</title>
        <meta name="description" content="Contact SharpSignal for support, billing, partnerships, or product feedback." />
      </Head>

      <main className="bg-slate-50 text-slate-950">
        <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Contact SharpSignal</h1>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              Questions about billing, Telegram access, the dashboard, or a pick in the record? Send the details and
              we will respond with the same transparency we expect from the model.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <div className="rounded border border-slate-200 bg-white p-6">
              <Mail className="h-7 w-7 text-slate-800" />
              <h2 className="mt-4 text-xl font-semibold">Email support</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Best for account access, billing, Telegram invite issues, or reporting incorrect grading.
              </p>
              <a href="mailto:SharpSignal@gmail.com" className="mt-5 inline-flex font-semibold text-slate-950 hover:underline">
                SharpSignal@gmail.com
              </a>
            </div>

            <div className="rounded border border-slate-200 bg-white p-6">
              <MessageSquareText className="h-7 w-7 text-slate-800" />
              <h2 className="mt-4 text-xl font-semibold">What to include</h2>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                <li>Your account email</li>
                <li>Stripe receipt or checkout email for billing issues</li>
                <li>Pick timestamp, sport, and market for grading questions</li>
              </ul>
            </div>
          </div>

          <div className="mt-10 rounded border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-semibold">Fast links</h2>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Link href="/reset-password" className="rounded border border-slate-300 px-4 py-3 text-center font-semibold hover:bg-slate-50">
                Reset password
              </Link>
              <Link href="/subscribe" className="rounded border border-slate-300 px-4 py-3 text-center font-semibold hover:bg-slate-50">
                Billing and pricing
              </Link>
              <Link href="/picks-preview" className="rounded bg-slate-950 px-4 py-3 text-center font-semibold text-white hover:bg-slate-800">
                View picks preview
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

// pages/join.js
import { useState } from 'react';
import Head from 'next/head';

export default function JoinPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // inside pages/subscribe.js
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          // include these if you capture them:
          sport_interest: 'all',
          utm_source: window?.utm_source || null,
          utm_medium: window?.utm_medium || null,
          utm_campaign: window?.utm_campaign || null,
          referrer: document?.referrer || null,
        }),
      });

    // Guard: server might return HTML on errors (e.g., static deploy/404)
    const ct = res.headers.get('content-type') || '';
    const payload = ct.includes('application/json') ? await res.json() : { error: await res.text() };

    if (!res.ok) throw new Error(payload?.error || `Join failed (${res.status})`);

    setSubmitted(true);
    setErrorMsg('');
  } catch (err) {
    setErrorMsg(err.message || 'Something went wrong');
  }
};

  return (
    <>
      <Head><title>Join SharpSignal</title></Head>
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-purple-700 text-white flex items-center justify-center px-4">
        <div className="bg-white text-gray-900 max-w-xl w-full rounded-xl shadow-lg p-8 space-y-6 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold">Join SharpSignal</h1>
          <p className="text-gray-600">Be first to receive high-conviction picks, performance recaps, and exclusive subscriber tools.</p>

          {submitted ? (
            <p className="text-green-600 font-semibold">Thanks! You&apos;re on the list ✅</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                className="w-full bg-indigo-600 text-white font-semibold px-4 py-3 rounded-lg hover:bg-indigo-700 transition"
              >
                Get Free Picks
              </button>
              {errorMsg && <p className="text-red-500 text-sm">{errorMsg}</p>}
            </form>
          )}
          <p className="text-xs text-gray-500">No spam. Unsubscribe anytime.</p>
        </div>
      </div>
    </>
  );
}

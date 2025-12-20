import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Link from 'next/link';
import { gaEvent } from "../lib/ga";


export default function SignUp() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [sport, setSport] = useState('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  // UTM state
  const [utm, setUtm] = useState({ source:'', medium:'', campaign:'', ref:'' })

  useEffect(() => {
	gaEvent({ action: "signup_start", category: "signup", label: "page_load" });
    const url = new URL(window.location.href)
    setUtm({
      source:   url.searchParams.get('utm_source')   || '',
      medium:   url.searchParams.get('utm_medium')   || '',
      campaign: url.searchParams.get('utm_campaign') || '',
      ref:      url.searchParams.get('ref')          || ''
    })
  }, [])

  const handleSignUp = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: 'https://sharps-signal.com/welcome',
      }
    })

    if (error) {
	  gaEvent({ action: "signup_error", category: "signup", label: error.message || "unknown_error" });
      setError(error.message)
      setLoading(false)
      return
    }
	
	gaEvent({ action: "signup_success", category: "signup", label: "account_created" });

    // Create profile record if user object is returned immediately
    if (data?.user?.id) {
      const { error: profileError } = await supabase.from('profiles').upsert([{
        id: data.user.id,
        email,
        role: 'user',
      }])
      if (profileError) {
        setError(`Signup succeeded but profile creation failed: ${profileError.message}`)
      }
    }

    // Log the lead + UTMs + sport pref and trigger welcome/alerts
    try {
      await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({
          email,
          sport_interest: sport,
          utm_source: utm.source,
          utm_medium: utm.medium,
          utm_campaign: utm.campaign,
          referrer: utm.ref
        })
      })
    } catch (_) {}

    setMessage('✅ Check your inbox for a confirmation email before signing in.')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="bg-white shadow-xl rounded-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6">Create Account</h1>
        <form onSubmit={handleSignUp} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required
              className="w-full px-4 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required
              className="w-full px-4 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">What sports do you want?</label>
            <select value={sport} onChange={(e)=>setSport(e.target.value)}
              className="w-full px-4 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="all">All sports</option>
              <option value="nba">NBA</option>
              <option value="mlb">MLB</option>
              <option value="nfl">NFL</option>
              <option value="nhl">NHL</option>
              <option value="soccer">Soccer</option>
              <option value="mma">MMA</option>
            </select>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md font-semibold hover:bg-indigo-700 transition">
            {loading ? 'Signing up…' : 'Sign Up'}
          </button>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-green-600">{message}</p>}
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link href="/signin" className="text-indigo-600 hover:underline">Sign In</Link>
        </p>
      </div>
    </div>
  )
}

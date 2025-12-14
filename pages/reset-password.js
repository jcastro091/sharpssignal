import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function ResetPassword() {
  const [email, setEmail]     = useState('')
  const [message, setMessage] = useState(null)
  const [error, setError]     = useState(null)
  const [loading, setLoading] = useState(false)

  const handleReset = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: process.env.NEXT_PUBLIC_BASE_URL + '/update-password'
      }
    )

    if (error) setError(error.message)
    else setMessage('✅ Check your email for a reset link.')
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: 400, margin: '0 auto' }}>
      <h1>Reset your password</h1>
      <form onSubmit={handleReset}>
        <label>Email address</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
      {error   && <p style={{ color:'red' }}>{error}</p>}
      {message && <p style={{ color:'green' }}>{message}</p>}
    </div>
  )
}

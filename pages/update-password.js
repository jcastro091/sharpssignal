import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'

export default function UpdatePassword() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [message, setMessage]   = useState(null)

  // 1) Grab session from the link
  useEffect(() => {
    supabase.auth.getSessionFromUrl({ storeSession: true })
      .catch(err => setError(err.message))
  }, [])

  const handleUpdate = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.updateUser({ password })

    if (error) setError(error.message)
    else {
      setMessage('✅ Your password has been updated!')
      // Optional: redirect after a delay
      setTimeout(() => router.push('/signin'), 2000)
    }
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: 400, margin: '0 auto' }}>
      <h1>Choose a new password</h1>
      <form onSubmit={handleUpdate}>
        <label>New password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? 'Updating…' : 'Update password'}
        </button>
      </form>
      {error   && <p style={{ color:'red' }}>{error}</p>}
      {message && <p style={{ color:'green' }}>{message}</p>}
    </div>
  )
}

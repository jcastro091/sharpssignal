// pages/auth/signup.js
import { useState } from 'react'
import { useRouter } from 'next/router'

export default function SignUp() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const router = useRouter()

  const handleSubmit = async (e) => {
    e.preventDefault()
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const payload = await res.json()
    if (res.ok) {
      // on success, send them to sign-in, then back to /picks
      router.push("/auth/signin?callbackUrl=/picks")
    } else {
      alert(`Error: ${payload.error}`)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-20 p-6 border rounded">
      <h1 className="text-2xl mb-4">Create an account</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          Email
          <input
            name="email"
            type="email"
            required
            className="w-full border p-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="block">
          Password
          <input
            name="password"
            type="password"
            required
            className="w-full border p-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button
          type="submit"
          className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
        >
          Sign Up
        </button>
      </form>
    </div>
  )
}

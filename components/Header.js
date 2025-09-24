import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function Header() {
  const supabase = createClientComponentClient()
  const router = useRouter()
  const [session, setSession] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => listener?.subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setSession(null)
    router.push('/signin')
  }

  return (
    <header className="bg-white shadow px-4 py-3">
      <nav className="max-w-5xl mx-auto flex items-center justify-between">
        {/* Left side */}
        <div className="flex flex-col items-start gap-2">
          <Link href="/" className="font-bold text-xl text-black">
            SharpsSignal
          </Link>
          <Link
            href="/subscribe"
            className="inline-flex items-center px-3 py-1 text-sm bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition"
          >
            🎯 Join for Free Picks
          </Link>
        </div>

        {/* Right side */}
        <div className="flex gap-2">
          {!session ? (
            <>
              <Link
                href="/signin"
                className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
              >
                Log In
              </Link>
              <Link
                href="/signup"
                className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
              >
                Sign Up
              </Link>
            </>
          ) : (
            <button
              onClick={handleLogout}
              className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
            >
              Log Out
            </button>
          )}
        </div>
      </nav>
    </header>
  )
}

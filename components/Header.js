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
    <header className="bg-white shadow px-4 py-2">
      <nav className="max-w-4xl mx-auto flex justify-between items-center">
        <Link href="/" className="font-bold text-lg">
          SharpSignal
        </Link>

        <div className="space-x-4 flex items-center">
		  
		  <Link href="/join" className="text-indigo-600 hover:underline">
		    🎯 Join for Free Picks
		  </Link>
		  

          {!session ? (
            <>
              <Link
                href="/signin"
                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Log In
              </Link>
              <Link
                href="/signup"
                className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Sign Up
              </Link>
            </>
          ) : (
            <button
              onClick={handleLogout}
              className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Log Out
            </button>
          )}
        </div>
      </nav>
    </header>
  )
}

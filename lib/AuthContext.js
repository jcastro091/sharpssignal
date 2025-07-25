import { createContext, useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export const AuthContext = createContext({
  session: null,
  user: null,
})

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)

  useEffect(() => {
    // 1) Get initial session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    // 2) Listen for changes (login, logout, token refresh)
    const { subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const user = session?.user ?? null

  return (
    <AuthContext.Provider value={{ session, user }}>
      {children}
    </AuthContext.Provider>
  )
}

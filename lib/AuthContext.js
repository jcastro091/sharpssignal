import { createContext, useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import { withAuthTimeout } from "./authWait";

export const AuthContext = createContext({
  session: null,
  user: null,
});

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);

  useEffect(() => {
    let active = true;
    let authEventObserved = false;
    withAuthTimeout(() => supabase.auth.getSession())
      .then(({ data }) => {
        if (active && !authEventObserved) setSession(data?.session || null);
      })
      .catch(() => {
        /* Sign-in owns the visible retry state. */
      });

    // 2) Listen for changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      authEventObserved = true;
      if (active) setSession(session);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const user = session?.user ?? null;

  return (
    <AuthContext.Provider value={{ session, user }}>
      {children}
    </AuthContext.Provider>
  );
}

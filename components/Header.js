import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

const publicLinks = [
  { href: "/picks-preview", label: "Preview" },
  { href: "/about", label: "Proof" },
  { href: "/subscribe", label: "Pricing" },
];

export default function Header() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [session, setSession] = useState(null);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) setSession(session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      mounted = false;
      listener?.subscription.unsubscribe();
    };
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    router.push("/signin");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-bold text-slate-950">
          <span className="flex h-8 w-8 items-center justify-center rounded bg-slate-950 text-sm text-white">
            SS
          </span>
          <span>SharpSignal</span>
        </Link>

        <div className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
          {publicLinks.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-slate-950">
              {link.label}
            </Link>
          ))}
          {session && (
            <Link href="/picks" className="hover:text-slate-950">
              Dashboard
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!session ? (
            <>
              <Link
                href="/signin?next=%2Fpicks"
                className="rounded border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Log In
              </Link>
              <Link
                href="/signup?next=%2Fpicks"
                className="rounded bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Sign Up
              </Link>
            </>
          ) : (
            <button
              onClick={handleLogout}
              className="rounded border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Log Out
            </button>
          )}
        </div>
      </nav>
    </header>
  );
}

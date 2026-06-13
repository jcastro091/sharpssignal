import { useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

export default function Welcome() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => router.push("/picks"), 8000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-16 text-slate-950">
      <section className="mx-auto max-w-2xl rounded border border-slate-200 bg-white p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded bg-emerald-100 font-bold text-emerald-800">
          OK
        </div>
        <h1 className="mt-5 text-3xl font-bold">Your account is confirmed</h1>
        <p className="mt-3 text-slate-600">
          Start with the dashboard and public record. If you upgrade, Stripe will verify payment and reveal the
          realtime Telegram invite from inside the dashboard.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link href="/picks" className="rounded bg-slate-950 px-5 py-3 font-semibold text-white hover:bg-slate-800">
            Open dashboard
          </Link>
          <Link href="/subscribe" className="rounded border border-slate-300 px-5 py-3 font-semibold hover:bg-slate-50">
            See Pro alerts
          </Link>
        </div>

        <p className="mt-6 text-sm text-slate-500">
          Redirecting to the dashboard. <Link href="/picks" className="font-semibold text-slate-950 hover:underline">Go now</Link>.
        </p>
      </section>
    </main>
  );
}

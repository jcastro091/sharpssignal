import { useEffect, useState } from "react";
import Link from "next/link";

export default function Footer() {
  const [year, setYear] = useState("2026");

  useEffect(() => {
    setYear(String(new Date().getFullYear()));
  }, []);

  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm text-slate-600 sm:px-6 md:grid-cols-[1.3fr_1fr_1fr]">
        <div>
          <div className="font-bold text-slate-950">SharpsSignal</div>
          <p className="mt-2 max-w-md leading-6">
            Private sports and currency-market intelligence with aggregate attestation.
            Research only. No guarantees.
          </p>
          <p className="mt-4 text-xs text-slate-500">Copyright {year} SharpsSignal. All rights reserved.</p>
        </div>

        <div>
          <div className="font-semibold text-slate-950">Product</div>
          <div className="mt-3 flex flex-col gap-2">
            <Link href="/about" className="hover:text-slate-950">Sports + Markets</Link>
            <Link href="/verification" className="hover:text-slate-950">Verification</Link>
            <Link href="/billing" className="hover:text-slate-950">Plans + Telegram access</Link>
          </div>
        </div>

        <div>
          <div className="font-semibold text-slate-950">Company</div>
          <div className="mt-3 flex flex-col gap-2">
            <Link href="/about" className="hover:text-slate-950">About</Link>
            <Link href="/contact" className="hover:text-slate-950">Contact</Link>
            <Link href="/legal#terms" className="hover:text-slate-950">Terms</Link>
            <Link href="/legal#privacy" className="hover:text-slate-950">Privacy</Link>
            <a href="mailto:SharpsSignal@gmail.com" className="hover:text-slate-950">SharpsSignal@gmail.com</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

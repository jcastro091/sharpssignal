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
          <div className="font-bold text-slate-950">SharpSignal</div>
          <p className="mt-2 max-w-md leading-6">
            Transparent sports betting picks, logged before game time and graded after results settle.
            Informational only. No guarantees, no hidden record.
          </p>
          <p className="mt-4 text-xs text-slate-500">Copyright {year} SharpSignal. All rights reserved.</p>
        </div>

        <div>
          <div className="font-semibold text-slate-950">Product</div>
          <div className="mt-3 flex flex-col gap-2">
            <Link href="/picks-preview" className="hover:text-slate-950">Preview picks</Link>
            <Link href="/signup?next=%2Fpicks" className="hover:text-slate-950">Create account</Link>
            <Link href="/subscribe" className="hover:text-slate-950">Pricing</Link>
            <Link href="/picks" className="hover:text-slate-950">Dashboard</Link>
          </div>
        </div>

        <div>
          <div className="font-semibold text-slate-950">Company</div>
          <div className="mt-3 flex flex-col gap-2">
            <Link href="/about" className="hover:text-slate-950">Proof process</Link>
            <Link href="/contact" className="hover:text-slate-950">Contact</Link>
            <Link href="/legal#terms" className="hover:text-slate-950">Terms</Link>
            <Link href="/legal#privacy" className="hover:text-slate-950">Privacy</Link>
            <a href="mailto:SharpSignal@gmail.com" className="hover:text-slate-950">SharpSignal@gmail.com</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

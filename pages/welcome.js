// /pages/welcome.js
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function Welcome() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => router.push('/signin'), 10000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 text-center">
      <h1 className="text-2xl font-bold mb-2">🎉 Welcome to SharpSignal</h1>
      <p className="mb-1">Your email has been confirmed.</p>
      <p className="mb-6">Pick one to get value right away:</p>

      <div className="flex flex-col sm:flex-row gap-3">
        <a
          href="https://t.me/+I-yXomYH5oNmN2Rh"
          className="px-5 py-3 rounded-md bg-indigo-600 text-white font-semibold"
        >
          👉 Join Free Telegram
        </a>
        <Link
          href="/signup"
          className="px-5 py-3 rounded-md bg-emerald-600 text-white font-semibold"
        >
          🔐 Create Dashboard Login
        </Link>
      </div>

      <p className="mt-6 text-sm text-gray-500">
        You’ll be redirected to sign in in a few seconds. If not,&nbsp;
        <Link href="/signin" className="text-indigo-600 underline">click here</Link>.
      </p>
    </div>
  );
}

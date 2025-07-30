// /pages/welcome.js
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function Welcome() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/signin');
    }, 4000);
    return () => clearTimeout(timer);
  }, [router]); // ✅ include router in deps

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 text-center">
      <h1 className="text-2xl font-bold mb-4">🎉 Welcome to SharpSignal</h1>
      <p className="mb-2">Your email has been confirmed.</p>
      <p className="mb-6">Redirecting you to sign in now...</p>
      <p className="text-sm text-gray-500">
        If you&apos;re not redirected,{' '}
        <Link href="/signin" className="text-indigo-600 underline">
          click here
        </Link>.
      </p>
    </div>
  );
}

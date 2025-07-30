// /pages/welcome.js
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Welcome() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/signin');
    }, 4000); // 4 second delay before redirecting
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 text-center">
      <h1 className="text-2xl font-bold mb-4">🎉 Welcome to SharpSignal</h1>
      <p className="mb-2">Your email has been confirmed.</p>
      <p className="mb-6">Redirecting you to sign in now...</p>
      <p className="text-sm text-gray-500">If you're not redirected, <a href="/signin" className="text-indigo-600 underline">click here</a>.</p>
    </div>
  );
}

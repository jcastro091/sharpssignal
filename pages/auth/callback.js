import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { createPagesBrowserClient, createPagesServerClient } from "@supabase/auth-helpers-nextjs";
import { getSafeNext } from "../../lib/authRedirect";

export async function getServerSideProps(ctx) {
  const supabase = createPagesServerClient(ctx);
  const { code, next } = ctx.query;
  const dest = getSafeNext(next);

  if (!code || typeof code !== "string") {
    return {
      props: { dest },
    };
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return {
      redirect: { destination: `/signin?next=${encodeURIComponent(dest)}`, permanent: false },
    };
  }

  return {
    redirect: { destination: dest, permanent: false },
  };
}

export default function AuthCallback({ dest }) {
  const router = useRouter();
  const supabase = useMemo(() => createPagesBrowserClient(), []);
  const [message, setMessage] = useState("Finishing sign in...");

  useEffect(() => {
    async function finishHashCallback() {
      const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (!accessToken || !refreshToken) {
        router.replace(`/signin?next=${encodeURIComponent(dest)}`);
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        setMessage(error.message);
        setTimeout(() => router.replace(`/signin?next=${encodeURIComponent(dest)}`), 1200);
        return;
      }

      router.replace(dest);
    }

    finishHashCallback();
  }, [dest, router, supabase]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md text-center">
        <h1 className="text-xl font-bold mb-2">SharpSignal</h1>
        <p className="text-sm text-gray-600">{message}</p>
      </div>
    </div>
  );
}

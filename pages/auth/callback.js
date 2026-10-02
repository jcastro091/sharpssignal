import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  createPagesBrowserClient,
  createPagesServerClient,
} from "@supabase/auth-helpers-nextjs";
import Link from "next/link";
import { withAuthTimeout } from "../../lib/authWait";
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

  let error;
  try {
    ({ error } = await withAuthTimeout(() =>
      supabase.auth.exchangeCodeForSession(code),
    ));
  } catch (e) {
    error = e;
  }

  if (error) {
    return {
      redirect: {
        destination: `/signin?next=${encodeURIComponent(dest)}`,
        permanent: false,
      },
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
    let active = true;
    async function navigate(target) {
      if (!active) return;
      const result = await withAuthTimeout(() => router.replace(target));
      if (result === false)
        throw new Error("Navigation did not finish. Please try again.");
    }
    async function finishHashCallback() {
      const params = new URLSearchParams(
        window.location.hash.replace(/^#/, ""),
      );
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (!accessToken || !refreshToken) {
        await navigate(`/signin?next=${encodeURIComponent(dest)}`);
        return;
      }

      const { error } = await withAuthTimeout(() =>
        supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        }),
      );
      if (!active) return;

      if (error) {
        setMessage("Unable to finish sign in. Please try again.");
        return;
      }

      await navigate(dest);
    }

    finishHashCallback().catch(() => {
      if (active) setMessage("Unable to finish sign in. Please try again.");
    });
    return () => {
      active = false;
    };
  }, [dest, router, supabase]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md text-center">
        <h1 className="text-xl font-bold mb-2">SharpSignal</h1>
        <p role="status" className="text-sm text-gray-600">
          {message}
        </p>
        <Link href={`/signin?next=${encodeURIComponent(dest)}`}>
          Return to sign in
        </Link>
      </div>
    </div>
  );
}

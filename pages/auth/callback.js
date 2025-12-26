// pages/auth/callback.js
import { createPagesServerClient } from "@supabase/auth-helpers-nextjs";

export async function getServerSideProps(ctx) {
  const supabase = createPagesServerClient(ctx);
  const { code, next } = ctx.query;

  // normalize next
  let dest = typeof next === "string" ? next : "/picks";
  if (!dest.startsWith("/")) dest = `/${dest}`; // handles next=picks

  if (!code || typeof code !== "string") {
    return {
      redirect: { destination: "/signin", permanent: false },
    };
  }

  // IMPORTANT: do this server-side so cookies get set
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return {
      redirect: { destination: "/signin", permanent: false },
    };
  }

  return {
    redirect: { destination: dest, permanent: false },
  };
}

export default function AuthCallback() {
  // never renders because SSR redirects
  return null;
}

import { createPagesServerClient } from "@supabase/auth-helpers-nextjs";

export async function getServerUser(req, res) {
  try {
    const supabase = createPagesServerClient({ req, res });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user || null;
  } catch {
    return null;
  }
}

export async function requireServerUser(req, res) {
  const user = await getServerUser(req, res);
  if (!user) {
    return { user: null, redirect: `/signin?next=${encodeURIComponent(req.url || "/picks")}` };
  }
  return { user, redirect: "" };
}

import { getServerUser, requireServerUser } from "./authServer";

function configuredEmails() {
  return String(process.env.CEO_DASHBOARD_EMAILS || process.env.ADMIN_EMAIL || "")
    .split(/[,\s]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function getCeoAccess(req, res) {
  const user = await getServerUser(req, res);
  const email = String(user?.email || "").toLowerCase();
  const allowlist = configuredEmails();
  return {
    user,
    email,
    allowed: Boolean(email) && (!allowlist.length || allowlist.includes(email)),
    allowlistConfigured: Boolean(allowlist.length),
  };
}

export async function requireCeoPageAccess(req, res) {
  const auth = await requireServerUser(req, res);
  if (!auth.user) return { ...auth, allowed: false, allowlistConfigured: Boolean(configuredEmails().length) };
  const access = await getCeoAccess(req, res);
  return {
    user: auth.user,
    redirect: access.allowed ? "" : "/picks",
    allowed: access.allowed,
    allowlistConfigured: access.allowlistConfigured,
    email: access.email,
  };
}

export function checkoutDestination(query = {}) {
  const params = new URLSearchParams();
  if (query.checkout === "success" || query.checkout === "cancelled")
    params.set("checkout", query.checkout);
  if (
    typeof query.session_id === "string" &&
    /^cs_[A-Za-z0-9_]{1,200}$/.test(query.session_id)
  )
    params.set("session_id", query.session_id);
  return "/dashboard" + (params.size ? "?" + params.toString() : "");
}
export function getSafeNext(value, fallback = "/dashboard") {
  const next = Array.isArray(value) ? value[0] : value;
  if (
    typeof next !== "string" ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.includes("\\")
  )
    return fallback;
  let url;
  try {
    url = new URL(next, "https://local.invalid");
  } catch {
    return fallback;
  }
  if (url.origin !== "https://local.invalid") return fallback;
  if (["/picks", "/dashboard"].includes(url.pathname))
    return checkoutDestination(Object.fromEntries(url.searchParams));
  return ["/admin", "/subscribe", "/update-password"].includes(next)
    ? next
    : fallback;
}
export function buildAuthCallbackUrl(origin, next = "/dashboard") {
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("next", getSafeNext(next));
  return url.toString();
}

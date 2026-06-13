export function getSafeNext(value, fallback = "/picks") {
  const next = Array.isArray(value) ? value[0] : value;

  if (!next || typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  if (next.startsWith("/auth/")) return fallback;

  return next;
}

export function buildAuthCallbackUrl(origin, next = "/picks") {
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("next", getSafeNext(next));
  return url.toString();
}

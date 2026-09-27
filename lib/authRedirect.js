export function getSafeNext(value, fallback = "/dashboard") {
 const next = Array.isArray(value) ? value[0] : value;
 if (next === "/picks") return "/dashboard";
 return ["/dashboard", "/admin", "/subscribe", "/update-password"].includes(next) ? next : fallback;
}
export function buildAuthCallbackUrl(origin, next = "/dashboard") {
 const url = new URL("/auth/callback", origin); url.searchParams.set("next", getSafeNext(next)); return url.toString();
}

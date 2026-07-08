export function cleanEnvToken(value, max = 500) {
  return String(value || "")
    .replace(/[\s\uFEFF\u200B-\u200D\u2060]/g, "")
    .slice(0, max);
}

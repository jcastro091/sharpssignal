// Display only: stored decimal prices remain unchanged.
function formatAmerican(value, missing = "—") {
  if (value == null || String(value).trim() === "") return missing;
  const n = Number(value);
  if (!Number.isFinite(n) || Math.abs(n) < 100) return missing;
  const rounded = Math.sign(n) * Math.round(Math.abs(n));
  return rounded > 0 ? `+${rounded}` : String(rounded);
}
function decimalToAmericanLabel(value, missing = "—") {
  if (value == null || String(value).trim() === "") return missing;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 1) return missing;
  return formatAmerican(n >= 2 ? (n - 1) * 100 : -100 / (n - 1), missing);
}
module.exports = { formatAmerican, decimalToAmericanLabel };

// Display only: keep full precision in stored prices and trade calculations.
const priceFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

function formatMarketPrice(value, missing = "—") {
  if (value == null || String(value).trim() === "") return missing;
  const price = Number(value);
  return Number.isFinite(price) ? priceFormatter.format(price) : missing;
}

module.exports = { formatMarketPrice };

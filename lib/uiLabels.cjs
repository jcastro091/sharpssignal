// Human-readable labels; stored values and comparisons remain unchanged.
function displayLabel(value, fallback = 'Pending') {
  const label = String(value || fallback).replaceAll('_', ' ').trim();
  return label.charAt(0).toUpperCase() + label.slice(1);
}
module.exports = { displayLabel };

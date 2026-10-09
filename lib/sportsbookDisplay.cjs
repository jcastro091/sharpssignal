const names = require('./sportsbookNames.json');
const aliases = Object.fromEntries(Object.entries(names).map(([key, label]) => [key.replace(/[^a-z0-9]/g, ''), label]));
function sportsbookName(value, missing = 'Not available') {
  const raw = String(value ?? '').trim();
  if (!raw) return missing;
  const key = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  return aliases[key] || Object.values(names).find(label => label.toLowerCase().replace(/[^a-z0-9]/g, '') === key) || raw.replace(/[_-]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}
module.exports = { sportsbookName };

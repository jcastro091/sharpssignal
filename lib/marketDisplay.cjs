const { displayLabel } = require('./uiLabels.cjs');
function marketLabel(value) { return displayLabel(String(value ?? '').replace(/\bh2h\b/gi, 'Moneyline'), ''); }
module.exports = { marketLabel };

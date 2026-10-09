function marketLabel(value) { return String(value ?? '').replace(/\bh2h\b/gi, 'Moneyline'); }
module.exports = { marketLabel };

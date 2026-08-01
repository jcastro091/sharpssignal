import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const publicCopy = ["pages/index.js", "pages/about.js", "pages/subscribe.js", "pages/verification.js", "components/Header.js", "components/Footer.js"].map(read).join("\n");

assert.match(publicCopy, /Sports \+ Markets/);
assert.match(publicCopy, /Private verification|private verification/i);
assert.match(publicCopy, /aggregate attestation/i);
assert.doesNotMatch(publicCopy, /View Today(?:'|&apos;)s Picks/i);
assert.doesNotMatch(publicCopy, /view public (?:record|ledger)|browse (?:recent|historical) picks|free picks preview/i);
assert.doesNotMatch(publicCopy, /2\s*[–-]\s*0|8\s*[–-]\s*0/i);

for (const path of ["pages/api/picks-preview.ts", "pages/api/proof-report.js", "pages/api/weekly-report.ts", "pages/api/trades.js"]) {
  assert.match(read(path), /status\(410\)/, `${path} must retire play-level public access`);
}

console.log("private positioning and retired public play routes verified");

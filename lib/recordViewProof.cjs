// Short-lived, user-bound proof that a released record was served to this member.
// No strategy details or raw record identifiers enter the event store.
const crypto = require("node:crypto");
const { signalKey } = require("./signalChanges.cjs");
function signingKey() {
  const key =
    process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw Error("record_measurement_unavailable");
  return key;
}
function sign(payload) {
  return crypto
    .createHmac("sha256", signingKey())
    .update("record-view-v1:" + payload)
    .digest("base64url");
}
function issueRecordProof(userId, section, play, now = Date.now()) {
  if (!play?.entry_id && !play?.trade_id)
    throw Error("record_identity_unavailable");
  const record = crypto
    .createHash("sha256")
    .update(section + ":" + signalKey(play))
    .digest("hex");
  const payload = Buffer.from(
    JSON.stringify({
      user: userId,
      section,
      record,
      expires: now + 30 * 60000,
    }),
  ).toString("base64url");
  return payload + "." + sign(payload);
}
function verifyRecordProof(value, userId, now = Date.now()) {
  try {
    if (typeof value !== "string" || value.length > 1500) return null;
    const [payload, signature, extra] = value.split(".");
    if (extra || !signature) return null;
    const a = Buffer.from(signature),
      b = Buffer.from(sign(payload));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return data.user === userId &&
      data.expires > now &&
      data.expires <= now + 30 * 60000 &&
      ["sports", "markets"].includes(data.section) &&
      /^[a-f0-9]{64}$/.test(data.record)
      ? data
      : null;
  } catch {
    return null;
  }
}
module.exports = { issueRecordProof, verifyRecordProof };

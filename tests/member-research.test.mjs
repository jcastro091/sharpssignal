import assert from "node:assert/strict";
import fs from "node:fs/promises";
const load = async (name) =>
  import(
    "data:text/javascript," +
      encodeURIComponent(
        await fs.readFile(new URL("../lib/" + name, import.meta.url), "utf8"),
      )
  );
const { feedState, resultLabel, firstRecordIndex } =
  await load("memberResearch.js");
assert.equal(feedState(null).kind, "loading");
assert.equal(feedState(null, "failure").kind, "unavailable");
assert.equal(
  feedState({ status: "unavailable", plays: [] }).kind,
  "unavailable",
);
assert.equal(feedState({ status: "available" }).kind, "unavailable");
assert.equal(feedState({ status: "unknown", plays: [] }).kind, "unavailable");
assert.equal(
  feedState({ status: "available", plays: [] }).title,
  "No published records yet",
);
assert.equal(
  feedState({ status: "no_qualifying_signals", plays: [] }).title,
  "No qualifying signals",
);
assert.equal(
  feedState({ status: "available", plays: [], publishing_paused: true }).kind,
  "paused",
);
assert.equal(feedState({ status: "stale", plays: [] }).kind, "stale");
assert.equal(resultLabel({ result: "pending" }), "Pending");
assert.equal(resultLabel({}), "Unavailable");
assert.equal(resultLabel({ result: "loss" }), "Loss");
assert.equal(resultLabel({ status: "closed" }, "markets"), "Closed");
assert.equal(
  firstRecordIndex([{ result: "pending" }, { result: "loss" }], "sports"),
  1,
);
const { trackMemberEvent } = await load("memberAnalytics.js");
globalThis.window = {
  location: { href: "https://example.invalid/?email=private@example.invalid" },
};
let payload;
globalThis.fetch = async (_, options) => {
  payload = JSON.parse(options.body);
};
await trackMemberEvent("member_feedback", {
  answer: "not_yet",
  section: "sports",
  email: "private@example.invalid",
  record_id: "private",
  url: window.location.href,
});
assert.deepEqual(payload, {
  event_name: "member_feedback",
  location: "member_first_use",
  metadata: { section: "sports", answer: "not_yet" },
});
console.log("Member state, first record, and analytics privacy checks passed.");

import assert from "node:assert/strict";
import fs from "node:fs/promises";
const load = async (path) =>
  import(
    "data:text/javascript," +
      encodeURIComponent(await fs.readFile(path, "utf8"))
  );
const authWaitSource = await fs.readFile("lib/authWait.js", "utf8");
const { withAuthTimeout, createAuthAttempt } = await load("lib/authWait.js");
const { getSafeNext, checkoutDestination, buildAuthCallbackUrl } = await load(
  "lib/authRedirect.js",
);
const verifierSource = (
  await fs.readFile("lib/checkoutVerification.js", "utf8")
).replace(
  /import \{ withAuthTimeout \} from ['"]\.\/authWait\.js['"];?/,
  authWaitSource.replaceAll("export ", ""),
);
const { createCheckoutVerifier } = await import(
  "data:text/javascript," + encodeURIComponent(verifierSource)
);
const pending = () => new Promise(() => {});
await assert.rejects(withAuthTimeout(pending, 5), /try again/);
assert.equal(await withAuthTimeout(() => 42, 20), 42);
await assert.rejects(
  withAuthTimeout(() => {
    throw Error("auth failure");
  }, 20),
  /auth failure/,
);
let finish;
const late = new Promise((r) => (finish = r));
let updates = 0;
await withAuthTimeout(() => late, 5).then(
  () => updates++,
  () => {},
);
finish("late");
await Promise.resolve();
assert.equal(updates, 0);
const attempts = createAuthAttempt();
const first = attempts.begin();
const retry = attempts.begin();
assert.equal(first(), false);
assert.equal(retry(), true);
attempts.invalidate();
assert.equal(retry(), false);
const target = "/dashboard?checkout=success&session_id=cs_test_owned";
assert.equal(
  checkoutDestination({ checkout: "success", session_id: "cs_test_owned" }),
  target,
);
assert.equal(
  getSafeNext(
    "/picks?checkout=success&session_id=cs_test_owned&redirect=https://evil.invalid",
  ),
  target,
);
assert.equal(
  new URL(buildAuthCallbackUrl("http://localhost", target)).searchParams.get(
    "next",
  ),
  target,
);
for (const input of [
  "//evil.invalid",
  "/\\evil.invalid",
  "https://evil.invalid",
  "/dashboard/../admin?bad=1",
  "/%2f%2fevil.invalid",
])
  assert.equal(getSafeNext(input), "/dashboard");
assert.equal(
  checkoutDestination({ checkout: ["success"], session_id: ["cs_test_owned"] }),
  "/dashboard",
);
let user = { id: "owner" };
let session = {
  mode: "subscription",
  status: "complete",
  payment_status: "paid",
  metadata: { user_id: "owner", plan: "pro_telegram" },
  subscription: { status: "active", metadata: { user_id: "owner" } },
};
let configured = true,
  calls = 0;
const handler = createCheckoutVerifier({
  getUser: async () => user,
  getStripe: () =>
    configured
      ? {
          checkout: {
            sessions: {
              retrieve: async () => {
                calls++;
                return session;
              },
            },
          },
        }
      : null,
});
async function request(method = "GET", id = "cs_test_owned") {
  const result = {};
  const res = {
    setHeader(k, v) {
      (result.headers ??= {})[k] = v;
    },
    status(s) {
      result.status = s;
      return this;
    },
    json(body) {
      result.body = body;
      return result;
    },
  };
  await handler({ method, query: { session_id: id } }, res);
  assert.equal(result.headers["Cache-Control"], "private, no-store");
  assert.equal("telegramUrl" in result.body, false);
  return result;
}
assert.deepEqual((await request()).body, {
  ok: true,
  paymentVerified: true,
  fulfillment: "not_activated",
});
for (const patch of [
  { payment_status: "unpaid" },
  { status: "open" },
  { mode: "payment" },
  { metadata: { user_id: "other", plan: "pro_telegram" } },
  { metadata: { plan: "pro_telegram" } },
  { metadata: { user_id: "owner", plan: "unknown" } },
  { subscription: { status: "past_due", metadata: { user_id: "owner" } } },
  { subscription: { status: "trialing", metadata: { user_id: "owner" } } },
  { subscription: { status: "active", metadata: { user_id: "other" } } },
  { subscription: "sub_unexpanded" },
]) {
  const previous = session;
  session = { ...session, ...patch };
  assert.equal((await request()).status, 403);
  session = previous;
}
configured = false;
assert.equal((await request()).status, 503);
configured = true;
user = null;
const before = calls;
assert.equal((await request()).status, 401);
assert.equal(calls, before);
user = { id: "owner" };
assert.equal((await request("POST")).status, 405);
assert.equal((await request("GET", ["cs_test_owned"])).status, 400);
console.log(
  "PASS auth timeout/retry/late result, redirect context, verifier ownership/payment/subscription/configuration, disabled fulfillment",
);
// Authenticate an account, then verify disabled purchasing never calls Stripe.
let createSource = await fs.readFile(
  "pages/api/stripe/create-checkout-session.js",
  "utf8",
);
createSource = createSource.replace(
  /^import[\s\S]*?from ["'][^"']+["'];\r?\n/gm,
  "",
);
createSource =
  'const billingUser=async()=>({user:{id:"owner",email:"owner@example.invalid"},stripe:{checkout:{sessions:{create(){throw Error("Unexpected Stripe checkout");}}}}});\n' +
  createSource;
const create = await import(
  "data:text/javascript," + encodeURIComponent(createSource)
);
let createResult;
const createResponse = {
  setHeader() {},
  status(status) {
    createResult = { status };
    return this;
  },
  json(body) {
    createResult.body = body;
  },
};
const previousPaidCheckout = process.env.PAID_CHECKOUT_ENABLED;
delete process.env.PAID_CHECKOUT_ENABLED;
try {
await create.default({ method: "POST", body: {} }, createResponse);
assert.deepEqual(createResult, {
  status: 403,
  body: { ok: false, error: "paid_checkout_not_enabled" },
});
} finally {
  if (previousPaidCheckout === undefined) delete process.env.PAID_CHECKOUT_ENABLED;
  else process.env.PAID_CHECKOUT_ENABLED = previousPaidCheckout;
}
console.log(
  "PASS actual checkout creation route refuses purchase before external calls",
);

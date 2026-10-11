const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Stripe = require('stripe');
const secret = 'whsec_local_regression_only';
const source = fs.readFileSync('pages/api/webhooks/stripe.js', 'utf8');
const handlerSource = source.slice(source.indexOf('export default async function handler')).replace('export default ', '');
async function deliver(type, metadata, signed = true) {
  let grants = 0;
  const handler = vm.runInNewContext(handlerSource + '; handler', {
    Stripe, process: { env: { STRIPE_SECRET_KEY: 'sk_test_local', STRIPE_WEBHOOK_SECRET: secret, QA_CHECKOUT_USER_ID: 'owner' } },
    buffer: async req => req.raw,
    verifiedWebhook: async (_req, res) => res.json({ received: true, outcome: 'ignored' }),
    createSupabaseServiceClient: () => ({}),
    require: () => ({ verifiedQAGrant: async () => { grants++; } }),
  });
  const payload = JSON.stringify({ id: 'evt_fixture', type, data: { object: { id: 'obj_fixture', metadata } } });
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ method: 'POST', raw: Buffer.from(payload), headers: { 'stripe-signature': signed ? Stripe.webhooks.generateTestHeaderString({ payload, secret }) : 'invalid' } }, res);
  return { status: res.statusCode, body: JSON.parse(JSON.stringify(res.body)), grants };
}
test('signed QA refund without owner metadata is acknowledged without granting access', async () => {
  for (const type of ['refund.created', 'refund.updated', 'refund.failed']) {
    const result = await deliver(type, { qa_test: 'true', qa_run_id: 'fixture' });
    assert.equal(result.status, 200);
    assert.equal(result.body.outcome, 'ignored');
    assert.equal(result.grants, 0);
  }
});
test('unsigned refund remains rejected', async () => {
  assert.equal((await deliver('refund.updated', { qa_test: 'true' }, false)).status, 400);
});
test('QA checkout still requires the configured owner', async () => {
  assert.equal((await deliver('checkout.session.completed', { qa_test: 'true', user_id: 'other' })).status, 403);
  const result = await deliver('checkout.session.completed', { qa_test: 'true', user_id: 'owner' });
  assert.equal(result.status, 200);
  assert.equal(result.grants, 1);
});

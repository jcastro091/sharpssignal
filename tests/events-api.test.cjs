const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  crypto = require("node:crypto");
const measurement = require("../lib/measurement.cjs");
function handler(result = { error: null }, user = null) {
  let sent;
  const source =
    fs
      .readFileSync("pages/api/events.js", "utf8")
      .replace(/import[\s\S]*?from ["'][^"']+["'];/g, "")
      .replace(
        "export default async function handler",
        "async function handler",
      ) + "\nmodule.exports=handler;";
  const box = {
    module: { exports: {} },
    require: path => path.includes('recordViewProof') ? require('../lib/recordViewProof.cjs') : measurement,
    getServerUser: async () => user,
    crypto,
    process: { env: { NODE_ENV: "production" } },
    console: { warn() {} },
    hasSupabaseServiceConfig: () => true,
    createSupabaseServiceClient: () => ({
      from: () => ({
        upsert: async (r) => {
          sent = r;
          return result;
        },
      }),
    }),
  };
  vm.runInNewContext(source, box);
  return { run: box.module.exports, sent: () => sent };
}
async function call(h, body, origin = "https://www.sharps-signal.com") {
  let status = 200,
    data;
  await h.run(
    {
      method: "POST",
      headers: { host: "www.sharps-signal.com", origin },
      body,
    },
    {
      status(s) {
        status = s;
        return this;
      },
      json(d) {
        data = d;
        return this;
      },
    },
  );
  return { status, data };
}
test("server rejects forged payments and cross-origin requests", async () => {
  const h = handler();
  assert.equal(
    (await call(h, { event_name: "subscribe_success" })).status,
    400,
  );
  assert.equal(
    (await call(h, { event_name: "page_view" }, "https://foreign.invalid"))
      .status,
    403,
  );
  assert.equal(h.sent(), undefined);
});
test("write failures return failure; unsupported schema cannot silently remove identity", async () => {
  assert.equal(
    (
      await call(handler({ error: { message: "unavailable" } }), {
        event_name: "page_view",
      })
    ).status,
    503,
  );
  assert.equal(
    (
      await call(
        handler({ error: { message: "Could not find the 'metadata' column" } }),
        { event_name: "page_view" },
      )
    ).status,
    503,
  );
});
test("server stores safe idempotency identity and strips private payload", async () => {
  const h = handler();
  const r = await call(h, {
    event_name: "page_view",
    event_id: "evt_test_1234567890",
    email: "private@example.invalid",
    page_url: "https://www.sharps-signal.com/billing?session_id=secret",
    page_path: "/billing",
    metadata: { test: true, password: "secret" },
  });
  assert.equal(r.data.persisted, true);
  assert.equal(h.sent().event_id, "evt_test_1234567890");
  assert.equal(h.sent().email, undefined);
  assert.equal(h.sent().metadata.password, undefined);
  assert.ok(!JSON.stringify(h.sent()).includes("secret"));
});

test("record views require an authenticated user and a matching signed feed receipt", async()=>{
 const {issueRecordProof}=require('../lib/recordViewProof.cjs');
 const previous=process.env.SUPABASE_SERVICE_ROLE_KEY;
 process.env.SUPABASE_SERVICE_ROLE_KEY='test-only';
 try {
  const user={id:'00000000-0000-0000-0000-000000000001',email_confirmed_at:new Date().toISOString()};
  const proof=issueRecordProof(user.id,'sports',{entry_id:'record-1'});
  const body={event_name:'record_view',page_path:'/dashboard',metadata:{record_proof:proof,authenticated_record:'forged',record_key:'forged'}};
  assert.equal((await call(handler(),body)).status,400);
  assert.equal((await call(handler({error:null},{...user,id:'another'}),body)).status,400);
  const h=handler({error:null},user);
  assert.equal((await call(h,body)).status,200);
  assert.equal(h.sent().user_id,user.id);
  assert.equal(h.sent().metadata.authenticated_record,'v1');
  assert.match(h.sent().metadata.record_key,/^[a-f0-9]{64}$/);
  assert.equal(h.sent().metadata.record_proof,undefined);
  const broken=handler({error:{message:"Could not find the 'user_id' column"}},user);
  assert.equal((await call(broken,body)).status,503);
 }finally{if(previous===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=previous;}
});

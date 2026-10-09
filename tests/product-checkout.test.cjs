const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ts=require('typescript'),{createRequire}=require('node:module');
function handler(ctx){const file=path.resolve('pages/api/stripe/create-checkout-session.js');const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;const real=createRequire(file),exports={};vm.runInNewContext(source,{exports,process,URL,require:n=>n.endsWith('/billingServer')?{billingUser:async()=>ctx}:real(n)});return exports.default;}
const response=()=>({setHeader(){},status(n){this.code=n;return this},json(v){this.body=v;return this;}});
test('actual checkout handler binds signup products and charges one unit each; browser prices are ignored',async()=>{
 process.env.PAID_CHECKOUT_ENABLED='true';process.env.STRIPE_PRICE_PRO_TELEGRAM='price_existing';process.env.CHECKOUT_ORIGIN='https://example.invalid';
 for(const selected of [['markets'],['sports','markets']]){
  let created;const query={select(){return this},eq(){return this},is:async()=>({data:[]})};
  const ctx={user:{id:'test-account',email:'test@example.invalid',user_metadata:{interests:selected}},supabase:{from:()=>query},stripe:{prices:{retrieve:async()=>({id:'price_existing',active:true,livemode:true,product:{active:true},type:'recurring',unit_amount:2000,currency:'usd',recurring:{usage_type:'licensed',interval:'month',interval_count:1}})},checkout:{sessions:{create:async args=>{created=args;return {livemode:true,url:'https://checkout.stripe.com/TEST'};}}}}};
  const res=response();await handler(ctx)({method:'POST',headers:{origin:'https://example.invalid',host:'example.invalid'},body:{price_id:'price_free',quantity:0}},res);
  assert.equal(res.body.ok,true);assert.equal(created.line_items[0].price,'price_existing');assert.equal(created.line_items[0].quantity,selected.length);
  assert.equal(created.metadata.products,selected.join(','));assert.equal(created.subscription_data.metadata.products,selected.join(','));assert.equal(created.metadata.user_id,'test-account');
  assert.match(created.custom_text.submit.message,/Markets/);
 }
});
test('invalid product requests cannot create a payment session',async()=>{
 const ctx={user:{id:'test-account'},stripe:{checkout:{sessions:{create:()=>assert.fail('invalid checkout')}}}};
 const res=response();await handler(ctx)({method:'POST',headers:{origin:'https://example.invalid',host:'example.invalid'},body:{products:['operations']}},res);assert.equal(res.code,503);
});

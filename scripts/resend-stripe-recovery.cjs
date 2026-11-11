// Explicit operator-only recovery. No payments, subscriptions or credentials are created.
const Stripe=require('stripe');
const {spawnSync}=require('node:child_process');
const endpoint='we_1Ree4PJRsCJh7NlTMyje89wU';
const events=['evt_1USLPYJRsCJh7NlTt1CfeloJ','evt_1USMMjJRsCJh7NlTMIpnPp8o','evt_1UZcqlJRsCJh7NlToI8c8mAb','evt_1UZdnWJRsCJh7NlTpSnglx3m'];
async function main(){
 if(process.argv[2]!=='--apply')throw Error('explicit_apply_required');
 if(Date.now()>Date.parse('2026-11-11T22:15:00Z'))throw Error('recovery_window_expired');
 const stripe=new Stripe(process.env.STRIPE_SECRET_KEY,{timeout:10000,maxNetworkRetries:1});
 const account=await stripe.accounts.retrieve();if(account.id!=='acct_1RecgUJRsCJh7NlT')throw Error('wrong_account');
 const destination=await stripe.webhookEndpoints.retrieve(endpoint);
 if(destination.livemode!==true||destination.status!=='enabled'||destination.url!=='https://www.sharps-signal.com/api/webhooks/stripe')throw Error('wrong_destination');
 for(const id of events){
  const event=await stripe.events.retrieve(id);
  if(!event.livemode||!['invoice.paid','customer.subscription.updated'].includes(event.type))throw Error('unexpected_event');
  if(event.pending_webhooks===0){console.log(JSON.stringify({event:'stripe_recovery_resend',id,status:'already_delivered'}));continue;}
  if(event.pending_webhooks!==1)throw Error('unexpected_pending_destinations');
  const run=spawnSync('npm',['exec','--yes','--package=@stripe/cli@1.55.10','--','stripe','events','resend',id,'--webhook-endpoint',endpoint,'--live','--confirm'],
    {env:{...process.env,STRIPE_API_KEY:process.env.STRIPE_SECRET_KEY},encoding:'utf8',timeout:120000,maxBuffer:1024*1024});
  // CLI can return complete customer objects. Never forward stdout/stderr to build logs.
  if(run.status!==0){console.log(JSON.stringify({event:'stripe_recovery_resend',id,status:'failed',exit_code:run.status}));throw Error('stripe_resend_failed');}
  console.log(JSON.stringify({event:'stripe_recovery_resend',id,type:event.type,status:'accepted'}));
 }
}
main().catch(()=>{console.error('stripe_recovery_failed');process.exitCode=1;});

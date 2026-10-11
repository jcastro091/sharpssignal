import {createHash} from 'crypto';
import {createSupabaseServiceClient} from './supabaseServer';
import {dbResult,commerceStripe,refundStore} from './pickCommerceServer';
import {gradeMLB} from './pickCommerce.cjs';
import {initiate} from './pickRefund.cjs';
export async function runPickRefundWorker(mode='live',onlyPick=null){
 const db=createSupabaseServiceClient(),stripe=commerceStripe(mode,{timeout:8000,maxNetworkRetries:0}),deadline=Date.now()+35000;
 let query=db.from('pick_fee_purchases').select('*').eq('billing_mode',mode).neq('status','refunded').order('refund_checked_at',{ascending:true,nullsFirst:true}).limit(20);
 if(onlyPick)query=query.eq('pick_id',onlyPick);
 const purchases=await dbResult(query),results=[];
 const offers=new Map();
 for(const p of purchases){
  if(Date.now()>deadline)break;
  try{
   let settlement=await dbResult(db.from('pick_fee_settlements').select('*').eq('pick_id',p.pick_id).eq('billing_mode',mode).maybeSingle());
   if(!settlement&&!p.owner_verification){
    let offer=offers.get(p.pick_id);
    if(!offer){offer=await dbResult(db.from('pick_fee_offers').select('*').eq('id',p.pick_id).maybeSingle());offers.set(p.pick_id,offer);}
    if(!offer||Date.parse(offer.game_time)>Date.now()){results.push({id:p.id,status:'awaiting_final_result'});continue;}
    const url='https://statsapi.mlb.com/api/v1/schedule?sportId=1&date='+offer.game_time.slice(0,10);
    const response=await fetch(url,{signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error('score_source_unavailable');
    const payload=await response.json(),graded=gradeMLB(offer,(payload.dates||[]).flatMap(d=>d.games||[]));
    if(!graded){results.push({id:p.id,status:'awaiting_final_result'});continue;}
    const candidate={pick_id:p.pick_id,billing_mode:mode,result:graded.result,verified:true,evidence_hash:createHash('sha256').update(JSON.stringify(graded.evidence)).digest('hex'),source_url:graded.source_url,evidence:graded.evidence,verified_by:offer.created_by};
    const saved=await db.from('pick_fee_settlements').insert(candidate);
    if(saved.error&&saved.error.code!=='23505')throw Error('settlement_persistence_failed');
    settlement=await dbResult(db.from('pick_fee_settlements').select('*').eq('pick_id',p.pick_id).eq('billing_mode',mode).single());
   }
   if(!settlement?.verified||settlement.status!=='final'||settlement.result!=='loss'){results.push({id:p.id,status:settlement?.result||'awaiting_final_result'});continue;}
   const offer=offers.get(p.pick_id)||await dbResult(db.from('pick_fee_offers').select('created_by').eq('id',p.pick_id).maybeSingle());
   const actor=offer?.created_by||settlement.verified_by;
   const refund=await initiate({purchaseId:p.id,adminId:actor,store:refundStore(db,actor),stripe});
   results.push({id:p.id,status:refund.status,stripe_refund_id:refund.stripe_refund_id});
  }catch(error){results.push({id:p.id,status:'needs_review',reason:['refund_requires_reconciliation','unsupported_settlement','ambiguous_or_missing_game','final_score_missing'].includes(error.message)?error.message:'verification_or_refund_failed'});}finally{await dbResult(db.from('pick_fee_purchases').update({refund_checked_at:new Date().toISOString()}).eq('id',p.id));}
 }
 // Also reconcile completed refunds: a bank can later return the funds.
 const claims=await dbResult(db.from('pick_fee_refund_claims').select('purchase_id,stripe_refund_id,admin_id,pick_fee_purchases!inner(billing_mode)').eq('pick_fee_purchases.billing_mode',mode).not('stripe_refund_id','is',null).order('checked_at',{ascending:true,nullsFirst:true}).limit(50));
 for(const c of claims){if(Date.now()>deadline)break;try{await initiate({purchaseId:c.purchase_id,adminId:c.admin_id,store:refundStore(db,c.admin_id),stripe});}catch{results.push({id:c.purchase_id,status:'reconciliation_needs_review'});}}
 const summary={orders_checked:results.filter(r=>r.status!=='reconciliation_needs_review').length,results};
 await dbResult(db.from('pick_fee_automation_state').upsert({billing_mode:mode,checked_at:new Date().toISOString(),summary}));
 return summary;
}

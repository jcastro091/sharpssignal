import {createHmac,timingSafeEqual} from 'crypto';
import {getCeoAccess} from '../../../lib/ceoAccess';
import {runPickRefundWorker} from '../../../lib/pickRefundWorker';
import {sameOrigin} from '../../../lib/pickCommerceServer';
export const config={maxDuration:60};
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
 const serviceKey=process.env.SUPABASE_SERVICE_ROLE||process.env.SUPABASE_SERVICE_ROLE_KEY;
 const expected=serviceKey?createHmac('sha256',serviceKey).update('pick-refund-worker-v1').digest('hex'):'';
 const provided=String(req.headers.authorization||'').replace(/^Bearer /,'');
 const trusted=expected.length>0&&provided.length===expected.length&&timingSafeEqual(Buffer.from(provided),Buffer.from(expected));
 if(!trusted){const a=await getCeoAccess(req,res);if(!a.allowed||!sameOrigin(req))return res.status(403).json({error:'admin_required'});}
 try{return res.json(await runPickRefundWorker(req.body?.mode==='test'?'test':'live'));}catch{return res.status(503).json({error:'refund_worker_unavailable'});}
}

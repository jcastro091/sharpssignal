import {createPagesServerClient} from '@supabase/auth-helpers-nextjs';
export async function ownerLivePlays(req,res,user){
 if(!user?.email_confirmed_at||String(user.email).toLowerCase()!=='sharpssignal@gmail.com')return null;
 try{
  const client=createPagesServerClient({req,res});const {data:{session}}=await client.auth.getSession();
  if(!session?.access_token)throw Error();
  const reply=await fetch('https://sharpssignal-sports-backend.vercel.app/api/owner-live-plays',{headers:{Authorization:'Bearer '+session.access_token},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)});
  if(!reply.ok)throw Error();const body=await reply.json();if(body.schema!=='prediction_live_tracking_v1')throw Error();return body;
 }catch{return {source_status:'unavailable',current:false,orders:[],venues:{}};}
}

import {createPagesServerClient} from '@supabase/auth-helpers-nextjs';
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');
 if(req.method!=='GET')return res.status(405).json({ok:false});
 try{
  const client=createPagesServerClient({req,res});const {data:{user}}=await client.auth.getUser();
  if(!user?.email_confirmed_at)return res.status(401).json({ok:false,error:'Sign in with a verified email.'});
  const {data:{session}}=await client.auth.getSession();
  const section=req.query.section;if(!['sports','markets'].includes(section))return res.status(400).json({ok:false});
  const response=await fetch('https://sharpssignal-sports-backend.vercel.app/api/member-feed?section='+section,{headers:{Authorization:'Bearer '+session.access_token},signal:AbortSignal.timeout(20000)});
  const body=await response.json();return res.status(response.status).json(body);
 }catch{return res.status(503).json({ok:false,error:'Your feed is temporarily unavailable. Please try again.'});}
}

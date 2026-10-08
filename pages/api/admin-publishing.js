import {getCeoAccess} from '../../lib/ceoAccess';
import {createSupabaseServiceClient} from '../../lib/supabaseServer';
export default async function(req,res){
 res.setHeader('Cache-Control','private, no-store');
 if(!['GET','POST'].includes(req.method))return res.status(405).json({ok:false});
 const access=await getCeoAccess(req,res);if(!access.allowed)return res.status(403).json({ok:false});
 try{
  const db=createSupabaseServiceClient();
  const read=await db.from('member_publication_settings').select('*').limit(1);
  if(read.error||!read.data?.[0])throw Error();
  const settings=read.data[0];
  if(req.method==='POST'){
   const origin=req.headers.origin;if(!origin||new URL(origin).host!==req.headers.host)return res.status(403).json({ok:false});
   const paused=req.body?.paused??req.body?.settings?.paused;
   if(typeof paused!=='boolean')return res.status(409).json({ok:false,error:'Plays now publish automatically after their delay. Immediate manual publishing is disabled.'});
   const saved=await db.from('member_publication_settings').update({paused}).eq('id',settings.id);
   if(saved.error)throw Error();settings.paused=paused;
  }
  return res.json({ok:true,settings,plays:[],publishing_mode:'all_eligible_research',delay_minutes:30});
 }catch{return res.status(503).json({ok:false,error:'publishing_settings_unavailable'});}
}

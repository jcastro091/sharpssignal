import crypto from 'crypto';
import {customerFeedContext,customerFeed} from '../../lib/customerFeedServer';
import {createSupabaseServiceClient} from '../../lib/supabaseServer';
export default async function(req,res){
 res.setHeader('Cache-Control','private, no-store');
 if(!['GET','POST'].includes(req.method))return res.status(405).json({ok:false});
 try{
  const ctx=await customerFeedContext(req,res);if(!ctx)return res.status(401).json({ok:false});
  const db=createSupabaseServiceClient();
  if(req.method==='POST'){
   const origin=req.headers.origin;if(!origin||new URL(origin).host!==req.headers.host)return res.status(403).json({ok:false});
   const id=req.body?.id;if(typeof id!=='string'||!/^research_[a-f0-9]{64}$/.test(id))return res.status(400).json({ok:false});
   const write=req.body.read===false?await db.from('member_notification_reads').delete().eq('user_id',ctx.user.id).eq('notification_id',id):await db.from('member_notification_reads').upsert({user_id:ctx.user.id,notification_id:id,read_at:new Date().toISOString()});
   if(write.error)throw Error();return res.json({ok:true});
  }
  const preferences=await db.from('member_alert_preferences').select('*').eq('user_id',ctx.user.id).maybeSingle();
  const reads=await db.from('member_notification_reads').select('notification_id').eq('user_id',ctx.user.id);
  if(preferences.error||reads.error)throw Error();
  const pref=preferences.data,interests=Array.isArray(ctx.user.user_metadata?.interests)?ctx.user.user_metadata.interests:['sports','markets'];
  const sections=['sports','markets'].filter(x=>interests.includes(x)&&(!pref?.sections?.length||pref.sections.includes(x)));
  const feeds=pref?.in_app===false?[]:await Promise.all(sections.map(async section=>{const result=await customerFeed(ctx,section);if(result.status!==200)throw Error();return {section,...result.body};}));
  const read=new Set((reads.data||[]).map(r=>r.notification_id));
  const notifications=feeds.flatMap(feed=>feed.plays.filter(play=>feed.section==='sports'?(!pref?.sports?.length||pref.sports.includes(play.sport))&&(!pref?.strategies?.length||pref.strategies.includes(play.arm)||(play.matched_strategies||[]).some(x=>pref.strategies.includes(x))):(!pref?.markets?.length||pref.markets.includes(play.symbol))).map(play=>{
   const id='research_'+crypto.createHash('sha256').update(JSON.stringify([feed.section,play])).digest('hex');
   return {id,section:feed.section,title:play.side||play.symbol,body:play.away?play.away+' @ '+play.home:String(play.direction>0?'Long':'Short'),play,delayed:feed.feed_mode!=='realtime',created_at:play.available_at||play.entry_time,read:read.has(id)};
  }));
  const unread_count=notifications.filter(x=>!x.read).length;return res.json({ok:true,notifications,items:notifications,unread_count,unread:unread_count});
 }catch{return res.status(503).json({ok:false,error:'notifications_unavailable'});}
}

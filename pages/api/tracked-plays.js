import {getServerUser} from '../../lib/authServer';
import {createSupabaseServiceClient} from '../../lib/supabaseServer';
import {customerFeedContext,customerFeed} from '../../lib/customerFeedServer';
import {interpretQuestion} from '../../lib/betQuestion.mjs';
const {signalKey,createTrackedPlay,gradeTrackedPlay,dashboard,answerQuestion}=require('../../lib/trackedPlays.cjs');
const questionWindows=new Map();

export default async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store');
  if (!['GET','POST'].includes(req.method)) {res.setHeader('Allow','GET, POST');return res.status(405).json({ok:false});}
  const user=await getServerUser(req,res);
  if (!user?.id || !user.email_confirmed_at) return res.status(401).json({ok:false,error:'Please sign in with a confirmed account.'});
  if (req.method==='POST') {
    try {if (new URL(req.headers.origin).host!==req.headers.host || req.headers['sec-fetch-site']==='cross-site') throw Error();}
    catch {return res.status(403).json({ok:false,error:'This request must come from your dashboard.'});}
  }
  try {
    const db=createSupabaseServiceClient();
    const body=req.body&&typeof req.body==='object'?req.body:{};
    if(body.action==='ask') {
      if(typeof body.question!=='string'||!body.question.trim()||body.question.length>500) return res.status(400).json({ok:false,error:'Ask a question of up to 500 characters.'});
      const now=Date.now();for(const [id,window] of questionWindows)if(window.until<now)questionWindows.delete(id);
      const window=questionWindows.get(user.id)||{until:now+60000,count:0};
      if(window.count>=10)return res.status(429).json({ok:false,error:'Please wait a minute before asking more questions.'});
      window.count++;questionWindows.set(user.id,window);
    }
    if (req.method==='POST' && body.action==='tail') {
      const ctx=await customerFeedContext(req,res,'sports');
      if (!ctx || ctx.user.id!==user.id) return res.status(401).json({ok:false,error:'Please sign in again.'});
      const feed=await customerFeed(ctx,'sports');
      if (feed.status!==200 || !Array.isArray(feed.body.plays)) throw Error('feed_unavailable');
      const play=feed.body.plays.find(x=>signalKey(x)===body.pick);
      if (!play || feed.body.publishing_paused) return res.status(409).json({ok:false,error:'This pick is no longer available. Refresh your dashboard.'});
      let row;
      try {row=createTrackedPlay(user,play,body);} catch(error) {return res.status(400).json({ok:false,error:error.message});}
      // Ignore duplicate clicks without overwriting the original stake, odds or timestamp.
      const saved=await db.from('customer_tracked_plays').upsert(row,{onConflict:'id',ignoreDuplicates:true});
      if(saved.error) throw saved.error;
      return res.status(200).json({ok:true,id:row.id});
    }
    if (req.method==='POST' && body.action!=='ask') return res.status(400).json({ok:false,error:'Unknown action.'});
    const {data:stored,error}=await db.from('customer_tracked_plays').select('*').eq('user_id',user.id).order('created_at',{ascending:false}).limit(1001);
    if(error) throw error;
    const partial=stored.length>1000, rows=stored.slice(0,1000), versions=new Map();
    // Read archived exact selections, including plays older than the 100-row feed.
    // Use the free publication delay for all customers' grades; never expose an unreleased result.
    const cutoff=new Date(Date.now()-Math.max(30,Number(process.env.FREE_FEED_DELAY_MINUTES)||30)*60000).toISOString();
    const settings=await db.from('member_publication_settings').select('paused').limit(1);
    if(settings.error) throw settings.error;
    const paused=!settings.data.length || settings.data[0].paused;
    if(!paused && rows.length) {
      const found=await db.rpc('tracked_play_results',{keys:rows.map(row=>row.play_key),released_before:cutoff});
      if(found.error) throw found.error;
      for(const item of found.data) versions.set(item.play_key,item.payload);
    }
    const all=rows.map(row=>gradeTrackedPlay(row,versions.get(row.play_key)));
    const filters=req.method==='GET'?req.query:body.filters;
    const data=dashboard(all,filters||{});
    let answer;
    if(body.action==='ask') {
      try {
        const intent=await interpretQuestion(body.question);
        const supported=['book','market'].includes(intent.dimension);
        answer=supported?answerQuestion(data,`${intent.dimension==='book'?'sportsbook':'market'} ${intent.direction==='worst'?'worst':'best'} ${intent.metric==='roi'?'ROI':'profit'}`):'I can compare your sportsbooks and markets by profit or ROI. Use the dashboard filters to choose your view; I cannot predict future results or access other users.';
      } catch {answer='The question service is temporarily unavailable. Your sportsbook and market breakdowns are still available above.';}
    }
    return res.status(200).json({ok:true,...data,options:{books:[...new Set(all.map(x=>x.sportsbook))],markets:[...new Set(all.map(x=>x.play.market))]},partial,publishing_paused:paused,...(answer?{answer}:{})});
  } catch {return res.status(503).json({ok:false,error:'Your tracked plays are temporarily unavailable. Please try again.'});}
}

const {issueRecordProof}=require("../../lib/recordViewProof.cjs");
import {customerFeedContext,customerFeed} from '../../lib/customerFeedServer';
export default async function(req,res){
 res.setHeader('Cache-Control','private, no-store');
 if(req.method!=='GET')return res.status(405).json({ok:false});
 try{
  const ctx=await customerFeedContext(req,res,req.query.section);if(!ctx)return res.status(401).json({ok:false,error:'confirmed_account_required'});
  const section=req.query.section;if(!['sports','markets'].includes(section))return res.status(400).json({ok:false});
  const response=await customerFeed(ctx,section);
  // Analytics failure never makes the member feed unavailable.
  if(response.status===200 && !response.body.publishing_paused && Array.isArray(response.body.plays)) {
    response.body.plays=response.body.plays.map(play=>{
      try{return {...play,analytics_view_token:issueRecordProof(ctx.user.id,section,play)};}catch{return play;}
    });
  }
  return res.status(response.status).json(response.body);
 }catch{return res.status(503).json({ok:false,error:'feed_unavailable'});}
}

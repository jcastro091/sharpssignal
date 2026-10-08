import {customerFeedContext,customerFeed} from '../../lib/customerFeedServer';
export default async function(req,res){
 res.setHeader('Cache-Control','private, no-store');
 if(req.method!=='GET')return res.status(405).json({ok:false});
 try{
  const ctx=await customerFeedContext(req,res);if(!ctx)return res.status(401).json({ok:false,error:'confirmed_account_required'});
  const section=req.query.section;if(!['sports','markets'].includes(section))return res.status(400).json({ok:false});
  const response=await customerFeed(ctx,section);return res.status(response.status).json(response.body);
 }catch{return res.status(503).json({ok:false,error:'feed_unavailable'});}
}

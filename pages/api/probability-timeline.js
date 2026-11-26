import {getServerUser} from '../../lib/authServer';
import {ownerProbabilityTimeline} from '../../lib/ownerLivePlaysServer';
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');
 if(req.method!=='GET')return res.status(405).json({ok:false});
 const user=await getServerUser(req,res);
 if(!user?.email_confirmed_at||String(user.email).toLowerCase()!=='sharpssignal@gmail.com')return res.status(403).json({ok:false});
 const record=req.query.record;
 if(typeof record!=='string'||!/^[a-f0-9]{64}$/.test(record))return res.status(400).json({ok:false});
 return res.status(200).json({ok:true,...await ownerProbabilityTimeline(req,res,user,record)});
}

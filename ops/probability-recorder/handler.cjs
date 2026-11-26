const {S3Client,GetObjectCommand,PutObjectCommand}=require('@aws-sdk/client-s3');
const {enrichLiveScores}=require('../../lib/liveScores.cjs');
const {liveRows}=require('../../lib/liveTrackedPlays.cjs');
const {sample,append,schema}=require('../../lib/probabilityTimeline.cjs');
const BUCKET='sharpsignal-ml-data',BASE='ops/movement_evidence/prediction-execution/live-pilot/v1/',PREFIX=BASE+'probability-timeline/v1/';
const s3=new S3Client({region:'us-east-2',maxAttempts:1});
async function get(key){const r=await s3.send(new GetObjectCommand({Bucket:BUCKET,Key:key}));return {data:JSON.parse(await r.Body.transformToString()),etag:r.ETag};}
async function put(key,data,condition={}){return s3.send(new PutObjectCommand({Bucket:BUCKET,Key:key,Body:JSON.stringify(data),ContentType:'application/json',...condition}));}
exports.handler=async()=>{
 const now=Date.now(),index=await get(PREFIX+'index.json');
 const source=await get(BASE+'dashboard.json');
 const rows=liveRows(source.data).filter(r=>r.result==='pending'&&Number.isFinite(r.play.start)&&now-r.play.start*1000<36*3600000&&r.play.start*1000-now<15*60000).slice(0,40);
 const scored=await enrichLiveScores(rows,{now});let written=0,valid=0,failures=0;
 for(const row of scored){
  const key=row.id.slice(5),path=PREFIX+'orders/'+key+'.json';
  try{
   const initial={schema,record_key:key,recording_started_at:new Date(now).toISOString(),selection:{...row.play},points:[]};
   try{await put(path,initial,{IfNoneMatch:'*'});}catch(e){if(e.$metadata?.httpStatusCode!==412)throw e;}
   const current=await get(path),point=sample(row,now,process.env.RECORDER_RELEASE),updated=append(current.data,point);
   if(updated!==current.data){await put(path,updated,{IfMatch:current.etag});written++;}
   if(point.win!=null)valid++;
   index.data.orders[key]={updated_at:updated.updated_at||updated.recording_started_at,points:updated.points.length,probability_points:updated.points.filter(p=>p.win!=null).length};
  }catch{failures++;}
 }
 index.data.generated_at=new Date(now).toISOString();index.data.release=process.env.RECORDER_RELEASE;
 index.data.last_cycle={tracked:rows.length,written,valid_probability:valid,failed:failures};
 index.data.health=failures?'attention':'healthy';
 await put(PREFIX+'index.json',index.data,{IfMatch:index.etag});
 return {schema,generated_at:index.data.generated_at,...index.data.last_cycle,health:index.data.health,orders_submitted:0};
};

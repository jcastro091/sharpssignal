function gameStart(value){
 if(value==null||value==='')return null;
 const numeric=typeof value==='number'||typeof value==='string'&&/^\d+(\.\d+)?$/.test(value);
 const at=numeric?(Number(value)<1e12?Number(value)*1000:Number(value)):Date.parse(value);
 if(!Number.isFinite(at)||at<946684800000||at>=4102444800000)return null;
 const date=new Date(at);
 return {iso:date.toISOString(),label:new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(date)};
}
module.exports={gameStart};

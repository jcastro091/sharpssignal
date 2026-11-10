// Refresh an open My Plays view without polling hidden tabs or overlapping work.
function startTrackedPlayRefresh({refresh,enabled,document,window}) {
  let last=0;
  const check=()=>{
    const now=Date.now();
    if(document.visibilityState==='visible' && enabled() && now-last>=5000){last=now;refresh();}
  };
  const timer=window.setInterval(check,60000);
  window.addEventListener('focus',check);
  document.addEventListener('visibilitychange',check);
  return ()=>{window.clearInterval(timer);window.removeEventListener('focus',check);document.removeEventListener('visibilitychange',check);};
}
module.exports={startTrackedPlayRefresh};

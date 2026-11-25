// This owner's personal tracking preference does not change other members' ledgers.
function predictionOnlyOwner(user) {
  return user?.id==='964c9fcb-dcfb-46df-acfc-766998148ff0' && Boolean(user.email_confirmed_at) && String(user.email).toLowerCase()==='sharpssignal@gmail.com';
}
function predictionVenue(value) {
  if(typeof value!=='string')return null;
  const name=value.trim().toLowerCase();
  if(name==='kalshi')return 'Kalshi';
  if(['polymarket us','polymarket_us','polymarket-us'].includes(name))return 'Polymarket US';
  if(name==='polymarket')return 'Polymarket';
  return null;
}
module.exports={predictionOnlyOwner,predictionVenue};

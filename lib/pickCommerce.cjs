function assert(ok,code){if(!ok)throw Error(code);}
function teaser(f){return {id:f.id,home_team:f.home_team,away_team:f.away_team,sport:f.sport,market:f.market,game_time:f.game_time,price_cents:f.price_cents,currency:f.currency,owner_verification:f.owner_verification};}
function paidEvidence(order,offer,session,payment){
 const m=session?.metadata;
 assert(session?.mode==='payment'&&session.status==='complete'&&session.payment_status==='paid','payment_not_complete');
 assert(m?.product_type==='pick'&&m.guarantee_version==='pick_fee_loss_v1'&&m.purchase_id===order.id&&m.pick_id===offer.id&&m.user_id===order.user_id&&order.offer_id===offer.id&&session.client_reference_id===order.user_id,'payment_binding_mismatch');
 assert(session.livemode===(offer.billing_mode==='live')&&payment.livemode===session.livemode,'payment_mode_mismatch');
 assert(session.amount_total===offer.price_cents&&session.currency===offer.currency&&payment.amount_received===session.amount_total&&payment.currency===session.currency&&payment.id===(typeof session.payment_intent==='string'?session.payment_intent:session.payment_intent?.id),'payment_amount_mismatch');
 assert(payment.status==='succeeded'&&payment.latest_charge?.captured&&!payment.latest_charge.disputed,'captured_payment_required');
 assert(payment.metadata?.purchase_id===order.id&&payment.metadata?.pick_id===offer.id&&payment.metadata?.user_id===order.user_id&&payment.metadata?.guarantee_version==='pick_fee_loss_v1','payment_binding_mismatch');
 assert(!order.checkout_session_id||order.checkout_session_id===session.id,'payment_binding_mismatch');
 return {order:order.id,checkout:session.id,payment:payment.id,user:order.user_id,offer:offer.id,amount:session.amount_total,currency:session.currency,live:session.livemode,tax:session.total_details?.amount_tax||0};
}
function gradeMLB(offer,games){
 assert(!offer.owner_verification&&offer.sport==='baseball_mlb'&&['h2h','moneyline'].includes(offer.market),'unsupported_settlement');
 const same=games.filter(g=>g.teams?.home?.team?.name===offer.home_team&&g.teams?.away?.team?.name===offer.away_team&&Math.abs(Date.parse(g.gameDate)-Date.parse(offer.game_time))<5*60000&&(!offer.source?.game_pk||String(g.gamePk)===String(offer.source.game_pk)));
 assert(same.length===1,'ambiguous_or_missing_game');const g=same[0];
 if(g.status?.abstractGameState!=='Final'||g.status?.codedGameState!=='F')return null;
 const home=g.teams.home.score,away=g.teams.away.score;
 assert(Number.isInteger(home)&&home>=0&&Number.isInteger(away)&&away>=0,'final_score_missing');
 assert(['home','away'].includes(offer.selection?.side),'invalid_pick_side');
 const result=home===away?'push':((home>away)===(offer.selection.side==='home')?'win':'loss');
 return {result,evidence:{game_pk:g.gamePk,game_date:g.gameDate,home_team:offer.home_team,away_team:offer.away_team,home_score:home,away_score:away,status:g.status,selection:offer.selection},source_url:'https://statsapi.mlb.com/api/v1/schedule?sportId=1&date='+offer.game_time.slice(0,10)};
}
module.exports={teaser,paidEvidence,gradeMLB};

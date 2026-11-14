// Explicit provider aliases only: do not expand "St" globally (it can mean Saint).
function normalizeTeamName(value) {
 const name=String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 return name==='youngstownstpenguins'?'youngstownstatepenguins':name;
}
module.exports={normalizeTeamName};

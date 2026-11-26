// Explicit provider aliases only: do not expand "St" globally (it can mean Saint).
const aliases = new Map([
 ['armyknights', 'armyblackknights'],
 ['youngstownstpenguins', 'youngstownstatepenguins'],
]);

function normalizeTeamName(value) {
 const name=String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 return aliases.get(name) ?? name;
}
module.exports={normalizeTeamName};

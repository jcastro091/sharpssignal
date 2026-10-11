import {useState} from 'react';
import {teamLogo} from '../lib/teamLogos.cjs';
export default function TeamLogo({name,sport}){
 const src=teamLogo(name,sport),[failed,setFailed]=useState(null);
 return src&&failed!==src?<img className="team-logo" src={src} alt={name+' logo'} width="48" height="48" loading="lazy" onError={()=>setFailed(src)}/>:<span className="team-logo team-logo-fallback" aria-label={name}>{String(name||'?').split(' ').map(x=>x[0]).slice(0,3).join('')}</span>;
}

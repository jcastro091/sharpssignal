import Link from 'next/link';

function Icon({name}) {
  const paths = {
    sports: <><path d="m4 16 6-6 4 4 6-10"/><path d="M15 4h5v5"/></>,
    markets: <><path d="M4 20V10m8 10V4m8 16v-7"/><path d="M2 20h20"/></>,
    alerts: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    upgrade: <><path d="m3 11 18-8-6 18-4-8-8-2Z"/><path d="m11 13 10-10"/></>,
    interests: <><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/></>,
    admin: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  };
  return <svg className="workspace-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export default function WorkspaceNav({interests, section, onSectionChange, onPreferenceChange, saving, notice, isAdmin}) {
  return <aside className="member-nav workspace-nav">
    <span className="eyebrow">YOUR WORKSPACE</span>
    <nav className="workspace-links" aria-label="Workspace">
      {interests.map(item=><button className="workspace-item" key={item} aria-current={section===item?'page':undefined} onClick={()=>onSectionChange(item)}><Icon name={item}/><span>{item==='sports'?'Sports':'Markets'}</span></button>)}
      <Link className="workspace-item" href="/alerts"><Icon name="alerts"/><span>Alerts</span></Link>
    </nav>
    <div className="workspace-tools">
      <Link className="workspace-item workspace-upgrade" href="/billing"><Icon name="upgrade"/><span>Upgrade + Telegram</span></Link>
      <details className="workspace-interests"><summary className="workspace-item"><Icon name="interests"/><span>My interests</span><svg className="workspace-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></summary>
        <div className="workspace-preferences">{['sports','markets'].map(item=><label key={item}><input type="checkbox" checked={interests.includes(item)} disabled={saving} onChange={()=>onPreferenceChange(item)}/>{item==='sports'?'Sports':'Markets'}</label>)}<p role="status">{notice}</p></div>
      </details>
      {isAdmin&&<Link className="workspace-item" href="/admin"><Icon name="admin"/><span>Admin workspace</span></Link>}
    </div>
    <small>Simulated records labeled.<br/>No automatic wagers.</small>
  </aside>;
}

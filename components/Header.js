import Link from 'next/link';
import {useContext} from 'react';
import {useRouter} from 'next/router';
import {AuthContext} from '../lib/AuthContext';
import {supabase} from '../lib/supabaseClient';
export default function Header(){const {user}=useContext(AuthContext);const router=useRouter();return <header className="brand-header"><nav><Link className="brand-wordmark" href="/"><img src="/sharpssignal-mark.png" width="42" height="42" alt=""/><span>SharpsSignal<span className="brand-wordmark-dot">.</span></span></Link><div className="desktop-links"><Link href="/picks-preview">The experience</Link><Link href="/verification">Our approach</Link>{user&&<Link href="/dashboard">My dashboard</Link>}</div><div className="header-actions">{user?<><Link className="button-secondary" href="/dashboard">Dashboard</Link><button className="text-button" onClick={async()=>{await supabase.auth.signOut();await router.push('/signin');}}>Sign out</button></>:<><Link className="text-button" href="/signin">Log in</Link><Link className="button-primary" href="/signup">Get started ↗</Link></>}</div></nav></header>}

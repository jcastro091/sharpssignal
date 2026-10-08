import Link from 'next/link';
export async function getServerSideProps(){return {redirect:{destination:'/billing',permanent:false}};}
export default function Subscribe(){return <main className="billing-shell"><Link href="/billing">View plans and Telegram access →</Link></main>;}

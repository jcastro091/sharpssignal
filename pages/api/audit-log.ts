import type { NextApiRequest, NextApiResponse } from 'next';

const BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8099';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const url = `${BASE}/api/audit_log${req.method === 'GET' ? `?${new URLSearchParams(req.query as any).toString()}` : ''}`;
  const r = await fetch(url, {
    method: req.method,
    headers: { 'content-type': 'application/json' },
    body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
  });
  const data = await r.json();
  res.status(r.status).json(data);
}

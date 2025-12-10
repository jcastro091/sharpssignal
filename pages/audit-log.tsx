import { useState } from "react";

export default function AuditLogPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [user, setUser] = useState("");
  const [decision, setDecision] = useState("");
  const [since, setSince] = useState("");

  async function search() {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries({ user, decision, since }).filter(([,v]) => v))
    ).toString();
    const r = await fetch(`/api/audit-log?${qs}`);
    setRows(await r.json());
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Audit Log</h1>
      <div style={{ display: "grid", gap: 8, maxWidth: 520, margin: "12px 0" }}>
        <input placeholder="User" value={user} onChange={e=>setUser(e.target.value)} />
        <input placeholder="Decision" value={decision} onChange={e=>setDecision(e.target.value)} />
        <input placeholder="Since (ISO 8601)" value={since} onChange={e=>setSince(e.target.value)} />
        <button onClick={search} style={{ width: 120, padding: 8 }}>Search</button>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>ID</th><th>Timestamp</th><th>User</th><th>Decision</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r:any) => (
            <tr key={r.id} style={{ borderTop: "1px solid #eee" }}>
              <td>{r.id}</td>
              <td>{r.ts_utc}</td>
              <td>{r.user_id}</td>
              <td>{r.decision}</td>
              <td>{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

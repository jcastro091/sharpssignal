import { useEffect, useState } from 'react';

type Field = { name:string; label:string; type:string; };
type Schema = { title:string; fields: Field[]; };

const defaultSchema: Schema = {
  title: "Audit Log Filter",
  fields: [
    { name: "user", label: "User", type: "text" },
    { name: "decision", label: "Decision", type: "text" },
    { name: "since", label: "Since (ISO 8601)", type: "text" }
  ]
};

export default function SchemaForm({ onSubmit }:{ onSubmit:(vals:any)=>void }) {
  const [schema] = useState<Schema>(defaultSchema);
  const [vals, setVals] = useState<any>({});

  return (
    <form onSubmit={(e)=>{e.preventDefault(); onSubmit(vals);}} className="grid gap-3">
      <h3 className="text-lg font-semibold">{schema.title}</h3>
      {schema.fields.map(f=>(
        <div key={f.name}>
          <label className="block text-sm">{f.label}</label>
          <input className="border p-2 rounded w-full"
                 type={f.type}
                 onChange={(e)=>setVals((v:any)=>({...v, [f.name]: e.target.value}))}/>
        </div>
      ))}
      <button className="px-3 py-2 rounded bg-black text-white">Apply</button>
    </form>
  );
}

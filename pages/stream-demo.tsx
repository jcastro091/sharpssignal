import { useState } from "react";

export default function StreamDemo() {
  const [prompt, setPrompt] = useState("Say hello in one sentence.");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setText("");
    const res = await fetch(`/api/stream?prompt=${encodeURIComponent(prompt)}`);
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      setText((t) => t + dec.decode(value));
    }
    setLoading(false);
  }

  return (
    <div style={{ padding: 24, display: "grid", gap: 12 }}>
      <h1>Stream Demo</h1>
      <textarea
        rows={3}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        style={{ width: "100%", padding: 8 }}
      />
      <button onClick={run} disabled={loading} style={{ width: 160, padding: 10 }}>
        {loading ? "Streaming..." : "Start Stream"}
      </button>
      <pre style={{ whiteSpace: "pre-wrap", border: "1px solid #ddd", padding: 12, minHeight: 120 }}>
        {text}
      </pre>
    </div>
  );
}

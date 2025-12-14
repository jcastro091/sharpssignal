import Head from "next/head";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import {
  Bot,
  Sparkles,
  Send,
  Loader2,
  Table as TableIcon,
  MessageSquareText,
  ShieldQuestion,
  Link as LinkIcon,
  Info,
} from "lucide-react";

/* ---------- Types returned by /api/assistant (preferred) ---------- */
type FaqMsg = { type: "faq"; answer: string };
type QuoteRow = { book: string; price: string; line?: string; side?: string; link?: string };
type QuoteMsg = {
  type: "quote";
  matchup: { home: string; away: string; league?: string; startTimeISO?: string };
  market: "h2h" | "spread" | "total";
  sideLabel: string;
  best: QuoteRow;
  others?: QuoteRow[];
  note?: string;
};
type MatchupSummaryMsg = {
  type: "matchup_summary";
  matchup: { home: string; away: string; league?: string; startTimeISO?: string };
  bullets: { label: string; value: string }[];
};
type PickMsg = {
  type: "pick";
  matchup: { home: string; away: string; league?: string; startTimeISO?: string };
  recommendation: string;
  reason: string;
  evPct?: number;
  suggestedStakePct?: number;
  proFeature?: boolean;
};
type ErrorMsg = { type: "error"; message: string };
type AssistantMsg = FaqMsg | QuoteMsg | MatchupSummaryMsg | PickMsg | ErrorMsg;

/* ---------- Local chat model ---------- */
type ChatItem = { role: "user" | "assistant"; content: AssistantMsg | string; ts: number };

/* ---------- Helpers ---------- */

// Intent (client-side fallback if server not responding)
function guessIntent(q: string) {
  const s = q.toLowerCase();
  if (/best odds|moneyline|ml\b|spread|total|h2h/.test(s)) return "quote";
  if (/matchup|summary|who (wins|is likely to win)|line.?movement|injur(y|ies)|weather/.test(s)) return "summary";
  if (/explain|why.*pick|reason|today('|)s pick|yesterday('|)s pick|last night/.test(s)) return "pick";
  if (/who are you|how.*work|sign ?up|pricing|terms|privacy|faq/.test(s)) return "faq";
  return "chat";
}

// Parse "TeamA at TeamB" / "TeamA vs TeamB"
function parseTeamsFrom(text: string): { home?: string; away?: string } {
  const t = text.toLowerCase().replace(/\s+/g, " ").trim();
  let m = t.match(/(.+?)\s+(?:at|@)\s+(.+)/i);
  if (m) return { away: m[1].trim(), home: m[2].trim() };
  m = t.match(/(.+?)\s+(?:vs|v\.?)\s+(.+)/i);
  if (m) return { home: m[1].trim(), away: m[2].trim() };
  return {};
}

// Normalize loose /api/chat responses into something readable
function normalizeLoose(j: any): AssistantMsg {
  if (j?.type === "faq" && typeof j.answer === "string") return { type: "faq", answer: j.answer };
  if (typeof j === "string") return { type: "faq", answer: j };
  return { type: "faq", answer: "Okay, got it." };
}

// Pretty-print times (ISO → local)
function fmtWhen(iso?: string) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/* ---------- Odds (legacy) pretty renderer ---------- */
function renderLegacyOdds(j: any) {
  if (!j || typeof j !== "object" || !Array.isArray(j.results) || !j.event) return null;
  const showLine = j.results.some((r: any) => r.line != null);
  const showSide = j.results.some((r: any) => r.side);
  return (
    <div className="space-y-3">
      <div className="text-sm text-gray-700">
        <div className="font-semibold">
          {j.event.away} <span className="text-gray-400">@</span> {j.event.home}
        </div>
        <div className="text-xs text-gray-500">
          {j.slots?.market && <>Market: <span className="font-medium uppercase">{j.slots.market}</span>{j.slots?.line != null ? ` ${j.slots.line}` : ""}</>}
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-gray-200 shadow bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Book</th>
              <th className="text-right px-3 py-2 font-medium">Price</th>
              {showLine && <th className="text-right px-3 py-2 font-medium">Line</th>}
              {showSide && <th className="text-right px-3 py-2 font-medium">Side</th>}
            </tr>
          </thead>
          <tbody>
            {j.results.map((r: any, i: number) => (
              <tr key={i} className="border-t">
                <td className="px-3 py-2 font-medium">{r.book}</td>
                <td className="px-3 py-2 text-right">{r.price}</td>
                {showLine && <td className="px-3 py-2 text-right">{r.line ?? "—"}</td>}
                {showSide && <td className="px-3 py-2 text-right">{r.side ?? "—"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {j.note && <p className="text-xs text-gray-500">{j.note}</p>}
    </div>
  );
}

/* ---------- Cards ---------- */
function QuoteCard({ msg }: { msg: QuoteMsg }) {
  const when = fmtWhen(msg.matchup.startTimeISO);
  return (
    <div className="bg-white/90 backdrop-blur rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b bg-gradient-to-r from-emerald-50 to-indigo-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TableIcon className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-semibold uppercase">{msg.market}</span>
        </div>
        <span className="text-xs text-gray-500">{when}</span>
      </div>
      <div className="p-4">
        <div className="text-sm text-gray-800 font-semibold">
          {msg.matchup.away} <span className="text-gray-400">@</span> {msg.matchup.home}
        </div>
        <div className="mt-1 text-sm">
          Best price for <span className="font-semibold">{msg.sideLabel}</span>
        </div>

        <div className="mt-3 border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Book</th>
                <th className="text-right px-3 py-2 font-medium">Price</th>
                {msg.best.line && <th className="text-right px-3 py-2 font-medium">Line</th>}
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="px-3 py-2 font-medium">{msg.best.book}</td>
                <td className="px-3 py-2 text-right">{msg.best.price}</td>
                {msg.best.line && <td className="px-3 py-2 text-right">{msg.best.line}</td>}
                <td className="px-3 py-2 text-right">
                  {msg.best.link && (
                    <a
                      href={msg.best.link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-800"
                    >
                      <LinkIcon className="w-4 h-4" /> Open
                    </a>
                  )}
                </td>
              </tr>
              {msg.others?.map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="px-3 py-2">{r.book}</td>
                  <td className="px-3 py-2 text-right">{r.price}</td>
                  {msg.best.line && <td className="px-3 py-2 text-right">{r.line ?? "—"}</td>}
                  <td className="px-3 py-2 text-right">
                    {r.link && (
                      <a
                        href={r.link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800"
                      >
                        <LinkIcon className="w-4 h-4" /> Open
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {msg.note && (
          <div className="mt-3 text-[11px] text-gray-500 flex items-center gap-1">
            <Info className="w-3.5 h-3.5" /> {msg.note}
          </div>
        )}
      </div>
    </div>
  );
}

function PickCard({ msg }: { msg: PickMsg }) {
  const when = fmtWhen(msg.matchup.startTimeISO);
  return (
    <div className="bg-white/90 backdrop-blur rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b bg-gradient-to-r from-indigo-50 to-blue-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquareText className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-semibold">AI Pick</span>
        </div>
        <span className="text-xs text-gray-500">{when}</span>
      </div>
      <div className="p-4 text-sm">
        <div className="text-gray-800 font-semibold">
          {msg.matchup.away} <span className="text-gray-400">@</span> {msg.matchup.home}
        </div>
        <div className="mt-1">
          <span className="font-semibold">Pick:</span> {msg.recommendation}
        </div>
        <div className="mt-1">
          <span className="font-semibold">Why:</span> {msg.reason}
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {typeof msg.evPct === "number" && (
            <span className="inline-flex items-center bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full">
              EV {msg.evPct.toFixed(2)}%
            </span>
          )}
          {typeof msg.suggestedStakePct === "number" && (
            <span className="inline-flex items-center bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full">
              Stake {msg.suggestedStakePct}% bk
            </span>
          )}
          {msg.proFeature && (
            <span className="inline-flex items-center bg-purple-50 text-purple-700 px-2 py-1 rounded-full">
              Pro
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ msg }: { msg: MatchupSummaryMsg }) {
  return (
    <div className="bg-white/90 backdrop-blur rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b bg-gradient-to-r from-blue-50 to-emerald-50 flex items-center gap-2">
        <ShieldQuestion className="w-4 h-4 text-blue-600" />
        <span className="text-sm font-semibold">Matchup Summary</span>
      </div>
      <div className="p-4 text-sm">
        <div className="text-gray-800 font-semibold">
          {msg.matchup.away} <span className="text-gray-400">@</span> {msg.matchup.home}
        </div>
        <ul className="mt-2 space-y-1">
          {msg.bullets.map((b, i) => (
            <li key={i}>
              <span className="font-medium">{b.label}:</span> {b.value}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function FaqCard({ msg }: { msg: FaqMsg }) {
  return (
    <div className="bg-white/90 backdrop-blur rounded-2xl border border-gray-200 shadow-sm p-4 text-sm">
      <div className="flex items-center gap-2 text-gray-800 font-medium">
        <Bot className="w-4 h-4 text-emerald-600" />
        Assistant
      </div>
      <p className="mt-2 text-gray-700">{msg.answer}</p>
    </div>
  );
}

function ErrorCard({ msg }: { msg: ErrorMsg }) {
  return (
    <div className="bg-white/90 backdrop-blur rounded-2xl border border-red-200 shadow-sm p-4 text-sm">
      <div className="text-red-700 font-semibold">⚠️ {msg.message}</div>
      <p className="text-xs text-gray-600 mt-1">
        Try another phrasing like <span className="font-medium">“best odds for yankees moneyline”</span>.
      </p>
    </div>
  );
}

/* ---------- Bubble renderer for normalized messages ---------- */
function AssistantBubble({ msg }: { msg: AssistantMsg }) {
  switch (msg.type) {
    case "faq":
      return <FaqCard msg={msg} />;
    case "quote":
      return <QuoteCard msg={msg} />;
    case "matchup_summary":
      return <SummaryCard msg={msg} />;
    case "pick":
      return <PickCard msg={msg} />;
    case "error":
    default:
      return <ErrorCard msg={msg as ErrorMsg} />;
  }
}

function renderAssistantContent(content: AssistantMsg | string) {
  if (typeof content === "string") {
    try {
      const j = JSON.parse(content);
      const legacy = renderLegacyOdds(j);
      if (legacy) return legacy;
    } catch {
      /* ignore */
    }
    return <FaqCard msg={{ type: "faq", answer: String(content) }} />;
  }
  return <AssistantBubble msg={content} />;
}

/* ---------- Page ---------- */
export default function Assistant() {
  const router = useRouter();
  const [chat, setChat] = useState<ChatItem[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [chat.length, busy]);

  // Prefill ?q= and auto-submit once
  useEffect(() => {
    const q = typeof router.query.q === "string" ? decodeURIComponent(router.query.q) : "";
    if (q) {
      setInput(q);
      // submit after paint
      setTimeout(() => {
        if (!busy) send(q, /*fromPrefill*/ true);
      }, 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.q]);

  async function send(forced?: string, fromPrefill = false) {
    const q = (forced ?? input).trim();
    if (!q || busy) return;

    setChat((c) => [...c, { role: "user", content: q, ts: Date.now() }]);
    if (!fromPrefill) setInput("");
    setBusy(true);

    const intent = guessIntent(q);
    let payload: AssistantMsg | null = null;

    // 1) Try unified /api/assistant (normalized)
    try {
      const r = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q }),
      });
      if (r.ok) {
        payload = await r.json();
      }
    } catch {
      /* ignore and fall back */
    }

    // 2) Fallback to existing endpoints and normalize on client
    try {
      if (!payload) {
        if (intent === "quote") {
          const r = await fetch("/api/odds-shop", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: q }),
          });
          const j = await r.json();
          setChat((c) => [...c, { role: "assistant", content: legacyToMsgOrString(j), ts: Date.now() }]);
          setBusy(false);
          return;
        }
        if (intent === "summary") {
          const teams = parseTeamsFrom(q);
          const r = await fetch("/api/matchup-chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sport: "baseball_mlb",
              league: "MLB",
              teams,
              question: q,
            }),
          });
          const j = await r.json();
          payload = { type: "faq", answer: j?.text || "Here’s your matchup summary." };
        } else {
          const r = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: q }),
          });
          const j = await r.json();
          payload = normalizeLoose(j);
        }
      }
    } catch (e: any) {
      payload = { type: "error", message: e?.message || "Network error." };
    }

    setChat((c) => [...c, { role: "assistant", content: payload || { type: "error", message: "No response." }, ts: Date.now() }]);
    setBusy(false);
  }

  const suggestions = useMemo(
    () => [
      { label: "best odds for yankees moneyline", intent: "quote" },
      { label: "explain today’s pick", intent: "pick" },
      { label: "matchup summary: yankees at red sox", intent: "summary" },
      { label: "how do I sign up?", intent: "faq" },
    ],
    []
  );

  return (
    <>
      <Head>
        <title>SharpsSignal Assistant</title>
        <meta name="description" content="Ask for best odds, AI pick explanations, and matchup summaries." />
      </Head>

      <main className="min-h-[100dvh] bg-gradient-to-br from-emerald-50 via-indigo-50 to-white flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-10 border-b backdrop-blur bg-white/70">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm font-semibold text-gray-800">SharpsSignal Assistant</span>
              <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 ml-2">
                Beta
              </span>
            </div>
            <a
              href="/"
              className="inline-flex items-center gap-2 text-xs text-gray-600 hover:text-gray-900"
            >
              <Sparkles className="w-4 h-4 text-emerald-600" />
              Home
            </a>
          </div>
        </header>

        {/* Suggestions */}
        <div className="max-w-4xl mx-auto w-full px-4 mt-4">
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => setInput(s.label)}
                className="text-xs md:text-sm bg-white/70 backdrop-blur border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50 text-gray-800 rounded-full px-3 py-1.5 transition shadow-sm"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chat area */}
        <div className="max-w-4xl mx-auto w-full px-4 mt-4 mb-32">
          <div
            ref={scrollerRef}
            className="bg-white/60 backdrop-blur rounded-3xl border border-gray-200 shadow-inner p-4 md:p-6 min-h-[40vh] max-h-[65vh] overflow-y-auto"
          >
            {chat.length === 0 && (
              <div className="text-center py-16 text-gray-600">
                <div className="inline-flex items-center gap-2 bg-white/70 backdrop-blur px-3 py-1.5 rounded-full border border-gray-200">
                  <Bot className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-semibold">Ask me anything</span>
                </div>
                <p className="mt-3 text-sm">
                  Try <span className="font-medium">“best odds for yankees moneyline”</span> or{" "}
                  <span className="font-medium">“explain today’s pick”</span>.
                </p>
              </div>
            )}

            <div className="space-y-4">
              {chat.map((item, i) => (
                <div key={i} className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}>
                  {item.role === "assistant" && (
                    <div className="mr-2 mt-1 rounded-full bg-emerald-100 text-emerald-700 p-1.5">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3 shadow-sm ${
                      item.role === "user"
                        ? "bg-gradient-to-r from-gray-800 to-gray-700 text-white rounded-br-none"
                        : "bg-white/90 backdrop-blur border border-gray-200 rounded-tl-none"
                    }`}
                  >
                    {item.role === "user" ? (
                      <span className="text-sm">{item.content as string}</span>
                    ) : (
                      renderAssistantContent(item.content as AssistantMsg | string)
                    )}
                  </div>
                </div>
              ))}

              {busy && (
                <div className="flex items-center gap-2 text-gray-500 text-sm pl-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="inline-flex gap-1 items-center">
                    Thinking
                    <span className="inline-flex">
                      <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.2s]"></span>
                      <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce mx-1"></span>
                      <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    </span>
                  </span>
                </div>
              )}
            </div>
          </div>
          <p className="text-[11px] text-gray-500 mt-3">
            Nothing here is financial advice. Bet responsibly.
          </p>
        </div>

        {/* Composer */}
        <div className="fixed bottom-0 left-0 right-0 border-t bg-white/80 backdrop-blur">
          <div className="max-w-4xl mx-auto w-full px-4 py-3">
            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask for odds, a matchup summary, or an AI pick…"
                  rows={1}
                  className="w-full resize-none rounded-2xl border border-gray-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 px-4 py-3 pr-12 shadow-sm bg-white/90 placeholder:text-gray-400"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                <button
                  onClick={() => send()}
                  disabled={busy || !input.trim()}
                  className="absolute right-2 bottom-2 inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold shadow
                             disabled:opacity-50 disabled:cursor-not-allowed
                             bg-gradient-to-r from-emerald-600 to-indigo-600 text-white hover:from-emerald-500 hover:to-indigo-500 transition"
                  aria-label="Send"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>

              <button
                onClick={() => {
                  setInput("");
                }}
                className="hidden sm:inline-flex rounded-xl border border-gray-300 bg-white/70 text-gray-700 px-3 py-2 text-sm hover:bg-white transition"
              >
                Clear
              </button>
            </div>

            {/* quick actions under composer */}
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {["best odds for yankees moneyline", "explain today’s pick", "matchup summary: yankees at red sox"].map(
                (ex) => (
                  <button
                    key={ex}
                    onClick={() => setInput(ex)}
                    className="rounded-full px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition"
                  >
                    {ex}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

/* ---------- Legacy helpers ---------- */
function legacyToMsgOrString(j: any): AssistantMsg | string {
  const legacy = renderLegacyOdds(j);
  if (legacy) {
    // Return stringified legacy payload; renderer will prettify above.
    return JSON.stringify(j);
  }

  // If The Odds API returned an error, show it clearly
  if (j?.error && typeof j.error === "string") {
    return { type: "error", message: j.error };
  }

  if (j?.type === "faq" && typeof j?.answer === "string") {
    return { type: "faq", answer: j.answer };
  }

  return { type: "faq", answer: "Here are the latest details." };
}

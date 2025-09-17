// /utils/tg.js
const TG_API = `https://api.telegram.org/bot${process.env.TG_BOT_TOKEN}`;

export async function tgSendMessage(chatId, text, extra = {}) {
  const res = await fetch(`${TG_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, ...extra })
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('TG sendMessage error:', err);
  }
}

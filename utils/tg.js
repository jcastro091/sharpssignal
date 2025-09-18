// utils/tg.js
export async function tgSendMessage(chatId, text) {
  const token = process.env.TG_BOT_TOKEN;
  if (!token) throw new Error('TG_BOT_TOKEN missing');
  if (!chatId) throw new Error('FOUNDER_TG_CHAT_ID missing');

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload.ok === false) {
    console.error('Telegram sendMessage failed:', { status: res.status, payload });
    throw new Error(`Telegram send failed: ${payload?.description || res.status}`);
  }
  return payload;
}

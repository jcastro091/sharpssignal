const PICK_SHOP_TIMEOUT_MS = 12000;
const UNAVAILABLE = 'The pick shop is temporarily unavailable. Please try again.';

// Bound both headers and body, including transports that ignore cancellation.
async function fetchPickShop(mode, {signal, timeoutMs = PICK_SHOP_TIMEOUT_MS} = {}) {
  const controller = new AbortController();
  let timer;
  let cancel;
  try {
    const cancelled = new Promise((_, reject) => {
      cancel = () => { controller.abort(); reject(new Error('request_cancelled')); };
      if (signal?.aborted) cancel();
      else signal?.addEventListener('abort', cancel, {once: true});
    });
    return await Promise.race([
      cancelled,
      new Promise((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error(UNAVAILABLE)); }, timeoutMs);
      }),
      (async () => {
        if (controller.signal.aborted) throw new Error('request_cancelled');
        const response = await fetch('/api/pick-shop?mode='+mode, {signal: controller.signal, cache: 'no-store'});
        const data = await response.json();
        if (!response.ok || !Array.isArray(data?.offers) || !Array.isArray(data?.recent_plays) || !Array.isArray(data?.orders)) throw new Error(UNAVAILABLE);
        return data;
      })(),
    ]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}
module.exports = {fetchPickShop, PICK_SHOP_TIMEOUT_MS};

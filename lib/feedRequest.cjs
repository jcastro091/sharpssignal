// One deadline covers both response headers and the JSON body.
const FEED_TIMEOUT_MS = 35000;
const TIMEOUT_MESSAGE = 'The feed took too long to respond. Please refresh to try again';
async function fetchMemberFeed(section, {signal, timeoutMs = FEED_TIMEOUT_MS} = {}) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) cancel();
  signal?.addEventListener('abort', cancel, {once:true});
  let timer;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch('/api/member-feed?section='+section, {signal:controller.signal, cache:'no-store'});
        const data = await response.json();
        if (!response.ok) throw Error(response.status === 401
          ? 'Your session has expired. Please sign in again'
          : 'The feed is temporarily unavailable. Please refresh to try again');
        if (!data || !Array.isArray(data.plays)) throw Error('The feed returned an invalid response. Please refresh to try again');
        return data;
      })(),
      new Promise((_, reject) => {
        timer = setTimeout(() => {reject(Error(TIMEOUT_MESSAGE)); controller.abort();}, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}
module.exports = {fetchMemberFeed, FEED_TIMEOUT_MS};

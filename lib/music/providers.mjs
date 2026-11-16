const cache = new Map();
let cacheBytes = 0;
export class MusicError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// All callers construct URLs from fixed provider origins and validated IDs.
export async function providerText(url, { maxBytes = 6000000, ttl = 300000 } = {}) {
  const cached = cache.get(url);
  if (cached?.expires > Date.now()) return cached.text;
  let response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(12000), redirect: 'error',
      headers: { 'Accept-Language': 'en-US,en;q=0.9' },
    });
    if (!response.ok) throw new Error('Provider HTTP ' + response.status);
    const reader = response.body.getReader();
    const chunks = []; let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) { await reader.cancel(); throw new Error('Response too large'); }
      chunks.push(value);
    }
    const text = Buffer.concat(chunks).toString('utf8');
    if (cache.has(url)) { cacheBytes -= cache.get(url).bytes; cache.delete(url); }
    while (cache.size && (cache.size >= 100 || cacheBytes + bytes > 24000000)) {
      const first = cache.keys().next().value;
      cacheBytes -= cache.get(first).bytes; cache.delete(first);
    }
    cache.set(url, { text, bytes, expires: Date.now() + ttl });
    cacheBytes += bytes;
    return text;
  } catch {
    throw new MusicError(502, 'The music source is unavailable right now. Please try again shortly.');
  }
}

export async function providerJson(url) {
  const text = await providerText(url, { maxBytes: 2000000 });
  try { return JSON.parse(text); } catch { throw new MusicError(502, 'The music source returned an unreadable response.'); }
}

export function youtubeId(input) {
  if (typeof input !== 'string' || input.length > 500) throw new MusicError(400, 'Paste a public YouTube video link (up to 500 characters).');
  let url;
  try { url = new URL(input); } catch { throw new MusicError(400, 'Paste a public YouTube video link.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new MusicError(400, 'Use an HTTPS YouTube link.');
  let id;
  if (url.hostname === 'youtu.be') id = url.pathname.slice(1);
  else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(url.hostname)) {
    id = url.pathname === '/watch' ? url.searchParams.get('v') : url.pathname.match(/^\/(?:live|embed|shorts)\/([^/]+)$/)?.[1];
  }
  if (!/^[\w-]{11}$/.test(id || '')) throw new MusicError(400, 'Use a YouTube video link, not a playlist or channel.');
  return id;
}

export function secondsLabel(value) {
  const seconds = Math.max(0, Math.floor(value || 0));
  return seconds >= 3600
    ? `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
    : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function searchLinks(artist, title) {
  const query = encodeURIComponent([artist, title].filter(Boolean).join(' '));
  return [
    { platform: 'Spotify', url: `https://open.spotify.com/search/${query}`, kind: 'search' },
    { platform: 'SoundCloud', url: `https://soundcloud.com/search/sounds?q=${query}`, kind: 'search' },
    { platform: 'YouTube', url: `https://www.youtube.com/results?search_query=${query}`, kind: 'search' },
  ];
}

export function normalized(value) {
  return String(value || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

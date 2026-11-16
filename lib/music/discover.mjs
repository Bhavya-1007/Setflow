import { MusicError, normalized, providerJson, searchLinks, youtubeId } from './providers.mjs';

async function deezer(path) {
  const data = await providerJson('https://api.deezer.com' + path);
  if (data.error) throw new MusicError(502, 'The catalog could not find this track. Try a title and artist search.');
  return data;
}

function trackId(value) {
  if (!/^\d{1,16}$/.test(String(value))) throw new MusicError(400, 'Choose a track from the search results.');
  return String(value);
}

export function catalogTrack(raw) {
  const bpm = Number(raw.bpm);
  return {
    id: String(raw.id), title: raw.title, artist: raw.artist?.name || 'Unknown artist',
    artistId: raw.artist?.id, album: raw.album?.title || '', version: raw.title_version || '',
    duration: raw.duration || null, releaseDate: raw.release_date || null,
    artwork: /^https:\/\/cdn-images\.dzcdn\.net\//.test(raw.album?.cover_medium || '') ? raw.album.cover_medium : null,
    preview: /^https:\/\/[\w-]+\.dzcdn\.net\//.test(raw.preview || '') ? raw.preview : null,
    bpm: Number.isFinite(bpm) && bpm >= 40 && bpm <= 250 ? bpm : null,
    key: null, metadataSource: 'Deezer catalog',
    links: [{ platform: 'Deezer', url: `https://www.deezer.com/track/${raw.id}`, kind: 'catalog' }, ...searchLinks(raw.artist?.name, raw.title)],
  };
}

export async function getTrack(id) { return catalogTrack(await deezer('/track/' + trackId(id))); }

export async function searchTracks(input) {
  if (typeof input !== 'string' || !input.trim() || input.length > 500) throw new MusicError(400, 'Enter a title and artist or a supported song link (up to 500 characters).');
  let query = input.trim();
  if (/^https?:\/\//i.test(query)) {
    let url;
    try { url = new URL(query); } catch { throw new MusicError(400, 'This song link is invalid.'); }
    if (url.protocol !== 'https:' || url.port || url.username || url.password) throw new MusicError(400, 'Use an HTTPS song link.');
    if (['deezer.com', 'www.deezer.com'].includes(url.hostname)) {
      const id = url.pathname.match(/^\/(?:[a-z]{2}\/)?track\/(\d+)\/?$/)?.[1];
      if (!id) throw new MusicError(400, 'Paste a Deezer track link, not an album or playlist.');
      return { tracks: [await getTrack(id)], query, note: 'Exact Deezer recording. Select it to find next-track ideas.' };
    }
    if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(url.hostname)) {
      const id = youtubeId(query);
      const metadata = await providerJson(`https://www.youtube.com/oembed?url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}&format=json`);
      query = metadata.title.replace(/\s*[([](?:official|music video|lyrics|audio)[^\])]*[\])]/gi, '').trim();
    } else if (url.hostname === 'open.spotify.com' && /^\/(?:intl-[a-z]{2}\/)?track\/[A-Za-z0-9]{22}$/.test(url.pathname)) {
      const metadata = await providerJson('https://open.spotify.com/oembed?url=' + encodeURIComponent(url.origin + url.pathname));
      query = metadata.title;
    } else {
      throw new MusicError(400, 'Supported links: Deezer tracks, Spotify tracks, and YouTube song videos. You can also search by title and artist.');
    }
  }
  const data = await deezer('/search?q=' + encodeURIComponent(query) + '&limit=15');
  return { tracks: (data.data || []).map(catalogTrack), query, note: 'Choose the recording, remix, or edit you mean. Link searches can return other versions.' };
}

export function rankCandidates(seed, candidates) {
  const seen = new Set([normalized(seed.artist + ' ' + seed.title)]);
  return candidates.filter(track => {
    const identity = normalized(track.artist + ' ' + track.title);
    if (track.id === seed.id || seen.has(identity)) return false;
    seen.add(identity); return true;
  }).map(track => {
    const delta = seed.bpm && track.bpm ? Math.abs(seed.bpm - track.bpm) : null;
    const reasons = [track.artistId === seed.artistId
      ? `Same artist as ${seed.artist}; a starting point for a similar sound.`
      : `Selected by Deezer’s artist radio for ${seed.artist}; a related-sound candidate.`];
    if (delta !== null) reasons.push(`${delta.toFixed(1)} BPM apart in the catalog. ${delta <= 6 ? 'A small tempo change to audition.' : 'Try a breakdown or phrase change rather than assuming a beatmatch.'}`);
    else reasons.push('Tempo compatibility is unverified. Audition the phrasing before mixing.');
    return { ...track, reasons, score: delta === null ? -20 : 20 - delta,
      mixNote: 'Key compatibility is unknown. Listen for clashing melodies and match phrases by ear.' };
  }).sort((a, b) => b.score - a.score).slice(0, 8);
}

export async function recommendTracks(id) {
  const seed = await getTrack(id);
  const radio = await deezer(`/artist/${trackId(seed.artistId)}/radio?limit=16`);
  const raw = (radio.data || []).filter(track => String(track.id) !== seed.id).slice(0, 12);
  const results = await Promise.allSettled(raw.map(track => getTrack(track.id)));
  const candidates = results.map((result, index) => result.status === 'fulfilled' ? result.value : catalogTrack(raw[index]));
  return { seed, recommendations: rankCandidates(seed, candidates),
    method: 'Related-artist radio, ranked by catalog tempo distance when available. These are listening suggestions, not audio-similarity measurements or guaranteed mixes.' };
}

export async function matchPublishedTrack(artist, title) {
  if (!artist || !title) return null;
  const results = await searchTracks(`${artist} ${title}`);
  const exact = results.tracks.find(track => normalized(track.artist) === normalized(artist) && normalized(track.title) === normalized(title));
  return exact ? getTrack(exact.id) : null;
}

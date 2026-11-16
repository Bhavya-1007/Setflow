import { MusicError, providerJson, providerText, searchLinks, youtubeId } from './providers.mjs';
import { matchPublishedTrack } from './discover.mjs';
import { youtubeAudioAccess } from './audio-access.mjs';

// Read embedded JSON as data, never evaluate scripts from a video page.
export function embeddedJson(html, name) {
  const marker = new RegExp(`(?:var\\s+)?${name}\\s*=\\s*`);
  const match = marker.exec(html);
  if (!match) return null;
  const start = html.indexOf('{', match.index + match[0].length);
  if (start < 0) return null;
  let depth = 0, quoted = false, escaped = false;
  for (let i = start; i < html.length; i++) {
    const char = html[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '{') depth++;
    else if (char === '}' && --depth === 0) {
      try { return JSON.parse(html.slice(start, i + 1)); } catch { return null; }
    }
  }
  return null;
}

function isoSeconds(value) {
  const match = String(value).match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  return match ? Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0) : null;
}

export function extractVideoPage(html) {
  const player = embeddedJson(html, 'ytInitialPlayerResponse');
  const details = player?.videoDetails;
  const initial = embeddedJson(html, 'ytInitialData');
  const watch = initial?.contents?.twoColumnWatchNextResults || initial?.contents?.singleColumnWatchNextResults;
  const contents = watch?.results?.results?.contents || watch?.results?.contents || [];
  const primary = contents.find(item => item.videoPrimaryInfoRenderer)?.videoPrimaryInfoRenderer;
  const secondary = contents.find(item => item.videoSecondaryInfoRenderer)?.videoSecondaryInfoRenderer;
  const text = value => value?.simpleText ?? value?.runs?.map(run => run.text || '').join('');
  // The full displayed description can remain available when playback metadata is withheld.
  // Do not use the truncated HTML description meta tag or recommended-video metadata.
  const description = details?.shortDescription ?? secondary?.attributedDescription?.content ?? text(secondary?.description);
  const title = details?.title || text(primary?.title);
  const durationMeta = html.match(/<meta\s+itemprop="duration"\s+content="([^"]+)"/i)?.[1];
  if (!title || typeof description !== 'string') return null;
  return { title, description, author: details?.author || text(secondary?.owner?.videoOwnerRenderer?.title) || 'YouTube',
    duration: Number(details?.lengthSeconds) || isoSeconds(durationMeta), source: 'Public YouTube video description' };
}

export async function videoMetadata(id) {
  if (process.env.YOUTUBE_API_KEY) {
    const data = await providerJson(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${id}&key=${encodeURIComponent(process.env.YOUTUBE_API_KEY)}`);
    const item = data.items?.[0];
    if (!item) throw new MusicError(502, 'YouTube could not provide this public video. Check the link or try again later.');
    return { title: item.snippet.title, author: item.snippet.channelTitle, description: item.snippet.description,
      duration: isoSeconds(item.contentDetails.duration), source: 'YouTube video description (Data API)' };
  }
  const html = await providerText(`https://www.youtube.com/watch?v=${id}&hl=en`);
  const video = extractVideoPage(html);
  if (!video) {
    throw new MusicError(502, 'YouTube did not expose the video description. This is not evidence of a missing tracklist. Paste a published tracklist below, or configure the optional YouTube Data API key.');
  }
  return video;
}

function timestamp(value) {
  const parts = value.split(':').map(Number);
  if (parts.slice(1).some(part => part > 59)) return null;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

function publishedLinks(text, artist, title) {
  const links = searchLinks(artist, title);
  for (const raw of text.match(/https:\/\/[^\s<>]+/g) || []) {
    try {
      const url = new URL(raw.replace(/[),.;]+$/, ''));
      if (url.username || url.password || url.port) continue;
      const index = links.findIndex(link =>
        (link.platform === 'Spotify' && url.hostname === 'open.spotify.com' && /^\/track\/[A-Za-z0-9]{22}$/.test(url.pathname)) ||
        (link.platform === 'SoundCloud' && ['soundcloud.com', 'www.soundcloud.com'].includes(url.hostname) && /^\/[^/]+\/[^/]+\/?$/.test(url.pathname)) ||
        (link.platform === 'YouTube' && ['www.youtube.com', 'youtube.com', 'youtu.be'].includes(url.hostname)));
      if (index >= 0) {
        if (links[index].platform === 'YouTube') youtubeId(url.href);
        links[index] = { platform: links[index].platform, url: url.href, kind: 'published' };
      }
    } catch { /* An invalid reference remains a clearly labelled search link. */ }
  }
  return links;
}

export function parseTracklist(text, duration = null, source = 'Published description') {
  const tracks = [], transitions = [], warnings = [];
  const time = '(\\d{1,3}:\\d{2}(?::\\d{2})?)';
  for (const line of String(text).slice(0, 50000).split(/\r?\n/)) {
    const trimmed = line.trim();
    const range = trimmed.match(new RegExp(`^\\[?${time}\\s*[-–—]\\s*${time}\\]?\\s*[:|–—-]?\\s*(.*)$`));
    if (range && /\b(?:transition|blend|mix in|mix out)\b/i.test(range[3])) {
      const start = timestamp(range[1]), end = timestamp(range[2]);
      if (start !== null && end > start && (!duration || end <= duration)) transitions.push({ start, end, text: range[3], source, evidence: line });
      continue;
    }
    const prefix = trimmed.match(new RegExp(`^(?:\\d+[.)]\\s*)?\\[?${time}\\]?\\s*[-–—|:]?\\s+(.+)$`));
    const suffix = !prefix && trimmed.match(new RegExp(`^(.+?)\\s+\\[?${time}\\]?$`));
    if (!prefix && !suffix) continue;
    const start = timestamp(prefix ? prefix[1] : suffix[2]);
    const raw = (prefix ? prefix[2] : suffix[1]).trim();
    if (start === null || (duration && start >= duration)) { warnings.push('Ignored a timestamp outside the video or with invalid seconds.'); continue; }
    if (/^(?:interview|outro|intro|introduction|subscribe|credits|talk|q\s*&\s*a)\b/i.test(raw) && !/\s[-–—]\s/.test(raw)) {
      tracks.push({ start, title: raw, artist: null, status: 'section', evidence: line, source, links: [], bpm: null, energy: null, key: null });
      continue;
    }
    const bpmMatch = raw.match(/\b(\d{2,3}(?:\.\d+)?)\s*BPM\b/i);
    const energyMatch = raw.match(/\benergy\s*[:=]?\s*(10|[1-9])(?:\s*\/\s*10)?\b/i);
    const keyMatch = raw.match(/\bkey\s*[:=]\s*((?:1[0-2]|[1-9])[AB]|[A-G][#b]?\s*(?:major|minor|maj|min))/i);
    const clean = raw.replace(/https:\/\/\S+/g, '').replace(/\s*\[?\b\d{2,3}(?:\.\d+)?\s*BPM\b\]?/gi, '')
      .replace(/\s*\[?\benergy\s*[:=]?\s*(?:10|[1-9])(?:\s*\/\s*10)?\]?/gi, '')
      .replace(keyMatch?.[0] || /$^/, '').replace(/^[\s|]+|[\s|]+$/g, '').trim();
    const parts = clean.split(/\s+[-–—]\s+/);
    const artist = parts.length > 1 ? parts.shift().trim() : null;
    const title = parts.join(' - ').trim() || clean;
    const unknown = /\b(?:ID|unknown|unidentified|unreleased ID)\b|\?\?/i.test(clean);
    tracks.push({ start, artist, title, status: unknown ? 'unidentified' : artist ? 'published' : 'unparsed',
      source, evidence: line, links: unknown ? [] : publishedLinks(raw, artist, title),
      bpm: bpmMatch && Number(bpmMatch[1]) >= 40 && Number(bpmMatch[1]) <= 250 ? Number(bpmMatch[1]) : null,
      key: keyMatch?.[1] || null, energy: energyMatch ? Number(energyMatch[1]) : null,
      bpmSource: bpmMatch ? source : null, energySource: energyMatch ? source : null,
    });
  }
  tracks.sort((a, b) => a.start - b.start);
  const unique = [];
  for (const row of tracks) {
    const previous = unique.at(-1);
    if (previous?.start === row.start) {
      previous.status = 'ambiguous'; previous.title += ' / ' + [row.artist, row.title].filter(Boolean).join(' - ');
      previous.evidence += '\n' + row.evidence; previous.artist = null; previous.links = []; previous.bpm = null; previous.energy = null; previous.key = null;
      warnings.push('Multiple entries share a timestamp; the overlap is labelled ambiguous.');
    } else unique.push(row);
  }
  if (!unique.length || unique[0].start > 0) unique.unshift({ start: 0, title: 'Unidentified section', artist: null, status: 'unidentified', links: [], bpm: null, energy: null, key: null, source });
  if (unique.length > 200) {
    const rest = unique[199].start;
    unique.splice(199, unique.length - 199, { start: rest, title: 'Remaining section not processed', artist: null, status: 'unidentified', links: [], bpm: null, energy: null, key: null, source });
    warnings.push('The first 199 cues are shown. The remaining section is unidentified because this tracklist exceeds the processing limit.');
  }
  for (let index = 0; index < unique.length; index++) {
    unique[index].end = unique[index + 1]?.start ?? duration;
    unique[index].id = 'cue-' + unique[index].start;
  }
  return { tracks: unique.slice(0, 200), transitions, warnings: [...new Set(warnings)],
    publishedCount: unique.filter(row => row.status === 'published').length };
}

export async function buildBreakdown(input, { metadata = videoMetadata, match = matchPublishedTrack } = {}) {
  const id = youtubeId(input.url);
  if (input.tracklist !== undefined && (typeof input.tracklist !== 'string' || input.tracklist.length > 30000)) throw new MusicError(400, 'Keep the pasted tracklist under 30,000 characters.');
  const pasted = input.tracklist?.trim();
  let video, metadataUnavailable = false;
  try { video = await metadata(id); }
  catch (error) {
    // A pasted source is still usable without public-page access; do not invent a duration.
    metadataUnavailable = true;
    video = { title: 'YouTube set', author: 'YouTube', description: '', duration: null, source: 'Video metadata unavailable' };
  }
  const source = pasted ? 'User-supplied tracklist (not independently verified)' : video.source;
  const parsed = parseTracklist(pasted || video.description, video.duration, source);
  if (metadataUnavailable) parsed.warnings.push('Automatic video metadata was unavailable. Video title, full duration and description could not be verified.' + (pasted ? ' Showing your pasted labels.' : ' This does not mean no tracklist exists.'));
  // Limit provider fan-out. Unmatched and unchecked rows remain explicit.
  const eligible = parsed.tracks.filter(track => track.status === 'published').slice(0, 12);
  let lookupFailures = 0;
  await Promise.all(eligible.map(async track => {
      try {
        const catalog = await match(track.artist, track.title);
        if (catalog) {
          track.catalog = { title: catalog.title, artist: catalog.artist, id: catalog.id };
          if (!track.bpm && catalog.bpm) { track.bpm = catalog.bpm; track.bpmSource = 'Deezer recording BPM (not measured in this set)'; }
          track.links.push(catalog.links[0]);
        }
      } catch { lookupFailures++; }
  }));
  if (lookupFailures) parsed.warnings.push('Some catalog lookups were unavailable; the published cues are still shown.');
  return { video: { id, title: video.title, author: video.author, duration: video.duration, url: `https://www.youtube.com/watch?v=${id}` },
    ...parsed, source, metadataAvailable: !metadataUnavailable,
    audioAccess: youtubeAudioAccess(input.url), audioAnalysis: null,
    noTracklist: metadataUnavailable && !pasted ? null : parsed.publishedCount === 0,
    notes: [
      'A published timestamp is an entry cue, not a measured blend boundary. Timeline blocks extend to the next posted cue; they do not prove continuous identification.',
      'Only the video description is checked automatically. A tracklist in comments or on another page can be pasted below. Missing cues and tracks may remain even between named entries.',
      'Values attached to posted tracks are published or catalog metadata, not audio measurements. Audio measurements appear only after real audio is analyzed.',
      'Matching catalog metadata is checked for up to 12 named entries; links labelled Search are not verified song matches. File analysis does not identify songs.',
    ],
  };
}

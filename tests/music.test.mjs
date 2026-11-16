import test from 'node:test';
import assert from 'node:assert/strict';
import { youtubeId, secondsLabel, searchLinks } from '../lib/music/providers.mjs';
import { catalogTrack, rankCandidates, searchTracks, getTrack } from '../lib/music/discover.mjs';
import { embeddedJson, extractVideoPage, parseTracklist, buildBreakdown } from '../lib/music/breakdown.mjs';

test('YouTube URLs use exact allowed hosts and validated video IDs', () => {
  for (const url of ['https://youtu.be/RvRhUHTV_8k?t=30', 'https://www.youtube.com/watch?v=RvRhUHTV_8k', 'https://youtube.com/live/RvRhUHTV_8k']) assert.equal(youtubeId(url), 'RvRhUHTV_8k');
  for (const url of ['http://youtube.com/watch?v=RvRhUHTV_8k', 'https://youtube.com.evil.test/watch?v=RvRhUHTV_8k', 'https://youtube.com@localhost/watch?v=RvRhUHTV_8k', 'https://youtube.com:8443/watch?v=RvRhUHTV_8k', 'https://youtube.com/playlist?list=abc', 'file:///etc/passwd', undefined]) assert.throws(() => youtubeId(url));
});

test('unsupported song links and invalid track IDs fail before network access', async () => {
  for (const input of ['', null, 'x'.repeat(501), 'https://localhost/private', 'https://deezer.com/album/123', 'https://open.spotify.com/playlist/abc']) await assert.rejects(() => searchTracks(input), { status: 400 });
  await assert.rejects(() => getTrack('../user/me'), { status: 400 });
});

test('catalog keeps real versions, rejects zero BPM, and never invents keys', () => {
  const track = catalogTrack({ id: 1, title: 'Song (Dub Mix)', artist: { id: 2, name: 'Artist' }, bpm: 0, preview: 'javascript:alert(1)' });
  assert.equal(track.title, 'Song (Dub Mix)'); assert.equal(track.bpm, null); assert.equal(track.key, null); assert.equal(track.preview, null);
  assert.equal(catalogTrack({ id: 2, bpm: 124.5 }).bpm, 124.5);
  assert.equal(track.links[0].kind, 'catalog');
  assert.ok(track.links.slice(1).every(link => link.kind === 'search'));
});

test('recommendations exclude the seed and duplicates, rank available BPM, and state uncertainty', () => {
  const seed = { id: '1', artist: 'Artist', artistId: 1, title: 'Seed', bpm: 124 };
  const candidates = [seed, { id: '2', artist: 'B', title: 'Unknown BPM', bpm: null }, { id: '3', artist: 'C', title: 'Close', bpm: 125 }, { id: '4', artist: 'D', title: 'Far', bpm: 140 }, { id: '5', artist: 'C', title: 'Close', bpm: 125 }];
  const ranked = rankCandidates(seed, candidates);
  assert.deepEqual(ranked.map(row => row.id), ['3', '4', '2']);
  assert.match(ranked[2].reasons.join(' '), /unverified/);
  assert.ok(ranked.every(row => /unknown/.test(row.mixNote)));
});

test('JSON embedded in HTML is parsed without executing scripts or breaking on quoted braces', () => {
  assert.deepEqual(embeddedJson('var ytInitialPlayerResponse = {"videoDetails":{"title":"a } \\\" b"}}; evil()', 'ytInitialPlayerResponse'), { videoDetails: { title: 'a } " b' } });
  assert.equal(embeddedJson('var ytInitialPlayerResponse = {bad}', 'ytInitialPlayerResponse'), null);
});

test('posted cues are sorted, preserve versions, and leave initial and ID gaps', () => {
  const result = parseTracklist('6:00 Artist B - Song (Dub Mix)\n[01:00] Artist A - Original\n10:00 ID - ID\n12:00 Interview', 900);
  assert.deepEqual(result.tracks.map(row => row.start), [0, 60, 360, 600, 720]);
  assert.equal(result.tracks[0].status, 'unidentified');
  assert.equal(result.tracks[2].title, 'Song (Dub Mix)');
  assert.equal(result.tracks[3].status, 'unidentified');
  assert.equal(result.tracks[4].status, 'section');
  assert.equal(result.tracks[4].end, 900);
  assert.deepEqual(result.transitions, []);
});

test('only explicit blend ranges become transitions; standalone cues never imply a blend', () => {
  const result = parseTracklist('00:00 A - One\n04:10 - 04:40 Transition from One to Two\n04:30 B - Two', 600);
  assert.equal(result.transitions.length, 1);
  assert.deepEqual([result.transitions[0].start, result.transitions[0].end], [250, 280]);
  assert.equal(result.tracks.length, 2);
});

test('bad timestamps are ignored and overlapping cues are ambiguous, not false identities', () => {
  const result = parseTracklist('00:00 A - First\n00:00 B - Second\n01:99 C - Bad\n30:00 D - Outside', 600);
  assert.equal(result.tracks.length, 1); assert.equal(result.tracks[0].status, 'ambiguous');
  assert.equal(result.tracks[0].artist, null); assert.deepEqual(result.tracks[0].links, []);
  assert.ok(result.warnings.length);
});

test('source BPM and energy remain posted metadata and missing energy is not synthesized', () => {
  const result = parseTracklist('0:00 Artist - Track | 120 BPM | energy 8/10 | key: 8A\n5:00 Other - Track | 130 BPM', 600);
  assert.equal(result.tracks[0].bpm, 120); assert.equal(result.tracks[0].energy, 8); assert.equal(result.tracks[0].key, '8A');
  assert.equal(result.tracks[0].estimatedEnergy, undefined);
  assert.equal(result.tracks[1].energy, null);
});

test('posted song links are marked as posted and never confused with search links', () => {
  const { tracks } = parseTracklist('0:00 Artist - Song https://open.spotify.com/track/0123456789012345678901', 300);
  assert.equal(tracks[0].links[0].kind, 'published');
  assert.equal(tracks[0].links[1].kind, 'search');
  assert.ok(searchLinks('A & B', 'Song?').every(link => link.kind === 'search' && link.url.startsWith('https://')));
});

test('no posted tracklist yields the entire unidentified span with no recognition claims', async () => {
  const result = await buildBreakdown({ url: 'https://youtu.be/Ca6pjR2TLns' }, {
    metadata: async () => ({ title: 'Live set', author: 'Artist', description: 'Subscribe to the channel.', duration: 4300, source: 'YouTube description' }),
    match: async () => { throw new Error('Should never query a song'); },
  });
  assert.equal(result.noTracklist, true); assert.equal(result.publishedCount, 0);
  assert.equal(result.tracks.length, 1); assert.equal(result.tracks[0].end, 4300);
  assert.equal(result.tracks[0].status, 'unidentified'); assert.equal(result.tracks[0].bpm, null);
  assert.deepEqual(result.transitions, []);
});

test('provider failures preserve source evidence and are not called missing tracklists', async () => {
  const unavailable = await buildBreakdown({ url: 'https://youtu.be/Ca6pjR2TLns' }, { metadata: async () => { throw new Error('Provider offline'); } });
  assert.equal(unavailable.noTracklist, null);
  assert.equal(unavailable.metadataAvailable, false);
  assert.equal(unavailable.audioAccess.supported, false);
  const result = await buildBreakdown({ url: 'https://youtu.be/Ca6pjR2TLns' }, {
    metadata: async () => ({ title: 'Set', description: '0:00 Artist - Song', duration: 600, source: 'YouTube description' }),
    match: async () => { throw new Error('Catalog offline'); },
  });
  assert.equal(result.publishedCount, 1); assert.equal(result.tracks[0].bpm, null);
  assert.match(result.warnings.join(' '), /unavailable/);
});

test('pasted tracklists override descriptions with explicit provenance', async () => {
  const result = await buildBreakdown({ url: 'https://youtu.be/Ca6pjR2TLns', tracklist: '0:00 Artist - Pasted' }, {
    metadata: async () => ({ title: 'Set', description: '0:00 Artist - Original', duration: 600, source: 'YouTube description' }), match: async () => null,
  });
  assert.match(result.source, /User-supplied/); assert.equal(result.tracks[0].title, 'Pasted');
});

test('long timestamps are displayed correctly', () => { assert.equal(secondsLabel(3794), '1:03:14'); assert.equal(secondsLabel(380), '6:20'); });

test('full displayed description is used when YouTube withholds playback metadata', () => {
  const initial = { contents: { twoColumnWatchNextResults: { results: { results: { contents: [
    { videoPrimaryInfoRenderer: { title: { runs: [{ text: 'Real set' }] } } },
    { videoSecondaryInfoRenderer: { attributedDescription: { content: '0:00 Artist - Real song\n5:00 Artist - Another' }, owner: { videoOwnerRenderer: { title: { runs: [{ text: 'Channel' }] } } } } },
  ] } } } } };
  const html = 'var ytInitialPlayerResponse = {"playabilityStatus":{"status":"LOGIN_REQUIRED"}}; var ytInitialData = ' + JSON.stringify(initial) + '; <meta itemprop="duration" content="PT10M30S">';
  const video = extractVideoPage(html);
  assert.equal(video.title, 'Real set'); assert.equal(video.author, 'Channel'); assert.equal(video.duration, 630);
  assert.equal(parseTracklist(video.description, video.duration).publishedCount, 2);
  assert.equal(extractVideoPage('<meta name="description" content="Truncated description...">'), null);
});

test('manual tracklists remain usable when all automatic metadata is unavailable', async () => {
  const result = await buildBreakdown({ url: 'https://youtu.be/Ca6pjR2TLns', tracklist: '0:00 Artist - Pasted\n6:00 Other - Song' }, {
    metadata: async () => { throw new Error('Unavailable'); }, match: async () => null,
  });
  assert.equal(result.publishedCount, 2); assert.equal(result.video.duration, null);
  assert.equal(result.tracks.at(-1).end, null); assert.match(result.warnings.join(' '), /could not be verified/);
});

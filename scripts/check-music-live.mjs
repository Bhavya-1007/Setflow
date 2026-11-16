// Opt-in integration checks: real public provider calls, no fixtures or credentials.
// Run with: node scripts/check-music-live.mjs
import assert from 'node:assert/strict';
import { searchTracks, recommendTracks } from '../lib/music/discover.mjs';
import { buildBreakdown } from '../lib/music/breakdown.mjs';

const search = await searchTracks('Daft Punk One More Time');
const selected = search.tracks.find(track => track.artist === 'Daft Punk' && track.title === 'One More Time');
assert.ok(selected, 'real song found in catalog');
const discovery = await recommendTracks(selected.id);
assert.ok(discovery.recommendations.length > 0, 'real recommendations returned');
assert.ok(discovery.recommendations.every(track => track.id !== selected.id && track.links.some(link => link.kind === 'catalog')));
console.log(JSON.stringify({ test: 'Discover', query: search.query, selected: `${selected.artist} — ${selected.title}`, id: selected.id, versions: search.tracks.length, recommendations: discovery.recommendations.map(track => ({ artist: track.artist, title: track.title, bpm: track.bpm, preview: Boolean(track.preview) })) }, null, 2));

for (const [id, expectedTracks] of [['RvRhUHTV_8k', true], ['Ca6pjR2TLns', false]]) {
  const breakdown = await buildBreakdown({ url: 'https://www.youtube.com/watch?v=' + id });
  assert.equal(breakdown.audioAccess.status, 'unsupported');
  assert.equal(breakdown.audioAnalysis, null, 'metadata must never pretend to be audio analysis');
  assert.equal(breakdown.publishedCount > 0, expectedTracks);
  assert.equal(breakdown.transitions.length, 0, 'no invented blend ranges');
  if (!expectedTracks) {
    assert.equal(breakdown.tracks.length, 1);
    assert.equal(breakdown.tracks[0].status, 'unidentified');
    assert.equal(breakdown.tracks[0].end, breakdown.video.duration);
    assert.equal(breakdown.tracks[0].bpm, null);
  }
  console.log(JSON.stringify({ test: 'Set Breakdown', ...breakdown.video, source: breakdown.source, publishedTracks: breakdown.publishedCount, sections: breakdown.tracks.length, noTracklist: breakdown.noTracklist, audioAccess: breakdown.audioAccess.status, catalogOrPostedBpms: breakdown.tracks.filter(track => track.bpm).length, transitions: breakdown.transitions.length, first: breakdown.tracks[0].title, last: breakdown.tracks.at(-1).title, warnings: breakdown.warnings }, null, 2));
}
console.log('PASS: real-song discovery; both YouTube links explicitly return UNSUPPORTED audio access, with no link-only measurements.');

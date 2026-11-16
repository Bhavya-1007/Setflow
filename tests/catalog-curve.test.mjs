import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogBpmPoints } from '../lib/music/catalog-curve.mjs';

test('catalog plot preserves timestamps and excludes posted-only, missing and non-track BPM', () => {
  const rows = [
    { id: 'a', status: 'published', start: 100, title: 'A', bpm: 140, catalog: { bpm: 123.05 } },
    { id: 'b', status: 'published', start: 200, bpm: 150 },
    { id: 'c', status: 'published', start: 300, catalog: { bpm: 0 } },
    { id: 'd', status: 'section', start: 400, catalog: { bpm: 180 } },
  ];
  assert.deepEqual(catalogBpmPoints(rows), { total: 3, highest: 123.05, points: [{ id: 'a', start: 100, title: 'A', bpm: 123.05 }] });
});

test('catalog plot retains ties and has an empty zero-data state', () => {
  assert.deepEqual(catalogBpmPoints([{ status: 'published', bpm: 120 }]), { total: 1, highest: null, points: [] });
  const result = catalogBpmPoints([120, 130, 130].map((bpm, i) => ({ id: String(i), status: 'published', start: i * 60, catalog: { bpm } })));
  assert.equal(result.highest, 130);
  assert.deepEqual(result.points.map(p => p.start), [0, 60, 120]);
  assert.equal(result.points.filter(p => p.bpm === result.highest).length, 2);
});

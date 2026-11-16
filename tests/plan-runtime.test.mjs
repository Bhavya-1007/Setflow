import test from 'node:test';
import assert from 'node:assert/strict';
import { fillPlanRuntime } from '../lib/plan-runtime.mjs';

function library(count, seconds = 180) {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1, name: `Track ${index + 1}`, seconds,
    energy: null, bpm: null, key: '', genre: '',
  }));
}

function draft(tracks, playSeconds = 180) {
  return {
    title: 'Test set', summary: 'A planned set.',
    tracks: tracks.map((track, index) => ({
      ...track, energy: 6, estimatedEnergy: true, playSeconds,
      nextId: tracks[index + 1]?.id ?? null,
      transition: tracks[index + 1] ? 'Original transition' : '',
    })),
  };
}

function verify(plan, source, expectedSeconds) {
  assert.equal(plan.tracks.reduce((sum, track) => sum + track.playSeconds, 0), expectedSeconds);
  assert.equal(new Set(plan.tracks.map((track) => track.id)).size, plan.tracks.length);
  for (const [index, track] of plan.tracks.entries()) {
    assert.ok(source.some((original) => original.id === track.id));
    assert.ok(Number.isInteger(track.playSeconds));
    assert.ok(track.playSeconds >= 15);
    assert.ok(track.playSeconds <= (track.seconds ?? 300));
    assert.equal(track.nextId, plan.tracks[index + 1]?.id ?? null);
    assert.equal(Boolean(track.transition), index < plan.tracks.length - 1);
  }
}

test('120-minute request with 59 tracks repairs a ten-track, 30-minute draft', () => {
  const tracks = library(59);
  const original = draft(tracks.slice(0, 10));
  const plan = fillPlanRuntime(original, { tracks, targetMinutes: 120 });
  verify(plan, tracks, 7200);
  assert.equal(plan.tracks.length, 40);
  assert.deepEqual(plan.tracks.slice(0, 10).map((track) => track.id), original.tracks.map((track) => track.id));
  assert.equal(plan.tracks[0].transition, 'Original transition');
  assert.ok(plan.tracks[9].transition);
  assert.equal(original.tracks.length, 10);
  assert.equal(original.tracks[9].transition, '');
});

test('extends selected excerpts before adding unused tracks', () => {
  const tracks = library(59, 720);
  const plan = fillPlanRuntime(draft(tracks.slice(0, 10)), { tracks, targetMinutes: 120 });
  verify(plan, tracks, 7200);
  assert.equal(plan.tracks.length, 10);
});

test('uses the whole insufficient library and reports a shortfall', () => {
  const tracks = library(59, 60);
  const plan = fillPlanRuntime(draft(tracks.slice(0, 10), 60), { tracks, targetMinutes: 120 });
  verify(plan, tracks, 3540);
  assert.equal(plan.tracks.length, 59);
  assert.match(plan.summary, /61 minutes short/);
});

test('unknown durations use bounded estimates and are disclosed', () => {
  const tracks = library(59, null);
  const plan = fillPlanRuntime(draft(tracks.slice(0, 10)), { tracks, targetMinutes: 120 });
  verify(plan, tracks, 7200);
  assert.match(plan.summary, /estimated excerpts/);
});

test('a remainder below 15 seconds is balanced across existing excerpts', () => {
  const tracks = library(4, 299);
  const plan = fillPlanRuntime(draft(tracks.slice(0, 2), 299), { tracks, targetMinutes: 10 });
  verify(plan, tracks, 600);
  assert.equal(plan.tracks.at(-1).playSeconds, 15);
});

test('overlong drafts are trimmed to the target with valid final transitions', () => {
  const tracks = library(59);
  const plan = fillPlanRuntime(draft(tracks), { tracks, targetMinutes: 10 });
  verify(plan, tracks, 600);
});

test('an on-target draft is preserved', () => {
  const tracks = library(40);
  const original = draft(tracks);
  assert.deepEqual(fillPlanRuntime(original, { tracks, targetMinutes: 120 }), original);
});

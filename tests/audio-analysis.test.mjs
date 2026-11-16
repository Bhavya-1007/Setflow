import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSegment, estimateKey, finishAnalysis, SAMPLE_RATE } from '../public/audio/analysis.mjs';
import { synthMix } from './helpers/audio-fixtures.mjs';
import { youtubeAudioAccess } from '../lib/music/audio-access.mjs';

test('both required YouTube URLs explicitly report unsupported audio, not measurements', () => {
  for (const id of ['RvRhUHTV_8k', 'Ca6pjR2TLns']) {
    const access = youtubeAudioAccess('https://youtu.be/' + id);
    assert.equal(access.supported, false); assert.equal(access.code, 'NO_VERIFIED_AUDIO_SOURCE');
    assert.deepEqual(access.supportedYouTubeIds, []); assert.match(access.fallback, /file/);
  }
  assert.throws(() => youtubeAudioAccess('https://example.com/audio.mp3'), { status: 400 });
});

test('silence has no fabricated tempo, key or transition', () => {
  const segment = analyzeSegment(new Float32Array(SAMPLE_RATE * 12));
  const result = finishAnalysis([segment], 12);
  assert.equal(segment.tempo.value, null); assert.equal(segment.key.value, null);
  assert.equal(result.segments[0].silent, true); assert.deepEqual(result.transitions, []);
});

test('tempo is measured from changed playback rates, and energy follows audio level', () => {
  const samples = synthMix();
  const first = analyzeSegment(samples.subarray(0, SAMPLE_RATE * 30));
  const second = analyzeSegment(samples.subarray(SAMPLE_RATE * 30), SAMPLE_RATE, 30);
  assert.ok(Math.abs(first.tempo.value - 120) < 3, JSON.stringify(first.tempo));
  assert.ok(Math.abs(second.tempo.value - 150) < 3, JSON.stringify(second.tempo));
  const result = finishAnalysis([first, second], 60);
  assert.ok(result.segments[1].energy > result.segments[0].energy);
  assert.ok(result.transitions.some(window => window.start <= 30 && window.end >= 30));
  assert.ok(result.transitions.every(window => window.confidence === 'low'));
  assert.equal(result.segments[0].start, 0); assert.equal(result.segments[1].end, 60);
});

test('tonal profiles can estimate a key but insufficient pitch evidence stays unavailable', () => {
  assert.equal(estimateKey(new Float64Array(12)).value, null);
  const oneNote = new Float64Array(12); oneNote[0] = 10;
  assert.equal(estimateKey(oneNote).value, null);
  const cMajor = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  assert.equal(estimateKey(cMajor).value, 'C major');
  const segment = analyzeSegment(synthMix(60).subarray(0, SAMPLE_RATE * 30));
  assert.equal(segment.key.value, 'C major', JSON.stringify(segment.key));
});

test('short, invalid and constant signals do not produce confident invented measurements', () => {
  assert.throws(() => analyzeSegment(new Float32Array([NaN])), /invalid/);
  assert.throws(() => analyzeSegment(new Float32Array(10), 44100), /11025/);
  const short = analyzeSegment(new Float32Array(100));
  assert.equal(short.tempo.value, null); assert.equal(short.key.value, null);
  const constant = analyzeSegment(new Float32Array(SAMPLE_RATE * 10).fill(.2));
  assert.equal(constant.tempo.value, null); assert.equal(constant.key.value, null);
});

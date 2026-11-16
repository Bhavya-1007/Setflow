import { analyzeSegment, finishAnalysis, SAMPLE_RATE, SEGMENT_SECONDS } from './analysis.mjs';
self.onmessage = ({ data }) => {
  try {
    const samples = data.samples;
    if (!(samples instanceof Float32Array) || samples.length < SAMPLE_RATE * 8 || samples.length > SAMPLE_RATE * 7200) throw new Error('Choose an audio file between 8 seconds and 2 hours.');
    const raw = [], size = SAMPLE_RATE * SEGMENT_SECONDS;
    for (let start = 0; start < samples.length; start += size) {
      raw.push(analyzeSegment(samples.subarray(start, Math.min(samples.length, start + size)), SAMPLE_RATE, start / SAMPLE_RATE));
      self.postMessage({ type: 'progress', value: Math.min(100, Math.round((start + size) / samples.length * 100)) });
    }
    self.postMessage({ type: 'result', result: finishAnalysis(raw, samples.length / SAMPLE_RATE) });
  } catch (error) { self.postMessage({ type: 'error', error: error.message }); }
};

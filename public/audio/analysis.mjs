// Dependency-free DSP over decoded mix samples. No catalog data enters this module.
export const ANALYSIS_VERSION = '1.0';
export const SAMPLE_RATE = 11025;
export const SEGMENT_SECONDS = 30;
const N = 2048, HOP = 256;
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const NOTES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const hann = Float64Array.from({ length: N }, (_, i) => .5 - .5 * Math.cos(2 * Math.PI * i / (N - 1)));

function fft(real, imaginary) {
  for (let i = 1, j = 0; i < N; i++) {
    let bit = N >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [real[i], real[j]] = [real[j], real[i]]; }
  }
  for (let size = 2; size <= N; size <<= 1) {
    const angle = -2 * Math.PI / size, cos = Math.cos(angle), sin = Math.sin(angle);
    for (let begin = 0; begin < N; begin += size) {
      let wr = 1, wi = 0;
      for (let j = 0; j < size / 2; j++) {
        const a = begin + j, b = a + size / 2;
        const tr = wr * real[b] - wi * imaginary[b], ti = wr * imaginary[b] + wi * real[b];
        real[b] = real[a] - tr; imaginary[b] = imaginary[a] - ti;
        real[a] += tr; imaginary[a] += ti;
        const next = wr * cos - wi * sin; wi = wr * sin + wi * cos; wr = next;
      }
    }
  }
}

function correlation(a, b) {
  const ma = a.reduce((s, v) => s + v, 0) / a.length, mb = b.reduce((s, v) => s + v, 0) / b.length;
  let cross = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) { const x = a[i] - ma, y = b[i] - mb; cross += x * y; aa += x * x; bb += y * y; }
  return cross / Math.sqrt(aa * bb || 1);
}

export function estimateKey(chroma) {
  const max = Math.max(...chroma), active = chroma.filter(value => value > max * .12).length;
  if (!max || active < 3) return { value: null, confidence: 'unavailable', reason: 'Insufficient stable tonal information.' };
  const candidates = [];
  for (let root = 0; root < 12; root++) for (const [mode, profile] of [['major', MAJOR], ['minor', MINOR]]) {
    const rotated = Array.from({ length: 12 }, (_, i) => profile[(i - root + 12) % 12]);
    candidates.push({ value: `${NOTES[root]} ${mode}`, score: correlation(Array.from(chroma), rotated) });
  }
  candidates.sort((a, b) => b.score - a.score);
  const [best, next] = candidates;
  if (best.score < .5 || best.score - next.score < .025) return { value: null, confidence: 'unavailable', reason: 'Tonal profiles are ambiguous; overlapping tracks or percussion may dominate.' };
  return { value: best.value, confidence: best.score > .72 && best.score - next.score > .09 ? 'medium' : 'low',
    alternative: next.value, reason: 'Chroma profile estimate from the mix audio; tuning, blends and relative major/minor ambiguity can affect it.' };
}

export function estimateTempo(onsets, rate) {
  if (onsets.length < rate * 8) return { value: null, confidence: 'unavailable', reason: 'At least eight seconds of rhythmic audio is needed.' };
  const mean = onsets.reduce((s, v) => s + v, 0) / onsets.length;
  const centered = onsets.map(value => value - mean);
  const power = centered.reduce((s, v) => s + v * v, 0);
  if (power < 1e-8) return { value: null, confidence: 'unavailable', reason: 'No clear rhythmic onsets.' };
  const low = Math.floor(rate * 60 / 180), high = Math.ceil(rate * 60 / 70);
  const ac = new Float64Array(high + 2);
  for (let lag = low - 1; lag <= high + 1; lag++) {
    let sum = 0, aa = 0, bb = 0;
    for (let i = lag; i < centered.length; i++) { const a = centered[i], b = centered[i - lag]; sum += a * b; aa += a * a; bb += b * b; }
    ac[lag] = sum / Math.sqrt(aa * bb || 1);
  }
  const peaks = [];
  for (let lag = low; lag <= high; lag++) if (ac[lag] >= ac[lag - 1] && ac[lag] >= ac[lag + 1]) peaks.push({ lag, score: ac[lag] });
  peaks.sort((a, b) => b.score - a.score);
  const best = peaks[0];
  if (!best || best.score < .23) return { value: null, confidence: 'unavailable', reason: 'No stable beat periodicity in this segment.' };
  const denominator = ac[best.lag - 1] - 2 * ac[best.lag] + ac[best.lag + 1];
  const shift = denominator ? Math.max(-.5, Math.min(.5, .5 * (ac[best.lag - 1] - ac[best.lag + 1]) / denominator)) : 0;
  const value = Math.round(60 * rate / (best.lag + shift) * 10) / 10;
  if (value < 70 || value > 180) return { value: null, confidence: 'unavailable', reason: 'Detected periodicity lies outside the 70–180 BPM search range.' };
  const other = peaks[1];
  return { value, confidence: best.score > .5 && (!other || best.score - other.score > .12) ? 'medium' : 'low',
    alternative: other ? Math.round(60 * rate / other.lag * 10) / 10 : null,
    reason: 'Beat periodicity measured from the mix, searched over 70–180 BPM. Half/double-time interpretations remain possible.' };
}

export function analyzeSegment(samples, sampleRate = SAMPLE_RATE, start = 0) {
  if (!(samples instanceof Float32Array) || sampleRate !== SAMPLE_RATE) throw new Error('Expected mono Float32 samples at 11025 Hz.');
  const seconds = samples.length / sampleRate;
  const real = new Float64Array(N), imaginary = new Float64Array(N), magnitude = new Float64Array(N / 2), previous = new Float64Array(N / 2);
  const chroma = new Float64Array(12), onsets = [], windows = [];
  let squares = 0, clipping = 0;
  for (const sample of samples) { if (!Number.isFinite(sample)) throw new Error('Audio contains invalid samples.'); squares += sample * sample; if (Math.abs(sample) >= .999) clipping++; }
  const rms = Math.sqrt(squares / (samples.length || 1));
  for (let frame = 0; frame + N <= samples.length; frame += HOP) {
    imaginary.fill(0);
    for (let i = 0; i < N; i++) real[i] = samples[frame + i] * hann[i];
    fft(real, imaginary);
    let flux = 0, mass = 0, weighted = 0;
    for (let bin = 1; bin < N / 2; bin++) {
      const value = Math.hypot(real[bin], imaginary[bin]); magnitude[bin] = value;
      flux += Math.max(0, Math.log1p(value) - Math.log1p(previous[bin]));
      previous[bin] = value; mass += value; weighted += value * bin * sampleRate / N;
    }
    onsets.push(flux);
    const bucket = Math.floor(frame / sampleRate / 5);
    if (!windows[bucket]) windows[bucket] = { start: start + bucket * 5, frames: 0, centroid: 0, chroma: new Array(12).fill(0), power: 0 };
    const window = windows[bucket]; window.frames++; window.centroid += mass ? weighted / mass : 0;
    let framePower = 0;
    for (let i = 0; i < HOP; i++) framePower += samples[frame + i] ** 2;
    window.power += framePower / HOP;
    // Spectral peaks reduce broadband percussion contribution to the tonal profile.
    for (let bin = 13; bin < Math.min(N / 2 - 1, Math.floor(2200 * N / sampleRate)); bin++) {
      if (magnitude[bin] <= magnitude[bin - 1] || magnitude[bin] <= magnitude[bin + 1]) continue;
      const frequency = bin * sampleRate / N;
      const midi = 69 + 12 * Math.log2(frequency / 440);
      if (Math.abs(midi - Math.round(midi)) > .35) continue;
      const pitch = ((Math.round(midi) % 12) + 12) % 12;
      const weight = Math.sqrt(magnitude[bin]); chroma[pitch] += weight; window.chroma[pitch] += weight;
    }
  }
  const silent = rms < .0003;
  const unavailable = { value: null, confidence: 'unavailable', reason: 'Silence or very low signal.' };
  const tempo = silent ? unavailable : estimateTempo(onsets, sampleRate / HOP);
  const key = silent || seconds < 8 ? { ...unavailable, reason: seconds < 8 ? 'Segment too short for a stable key estimate.' : unavailable.reason } : estimateKey(chroma);
  if (clipping / (samples.length || 1) > .01) { if (tempo.value) tempo.confidence = 'low'; if (key.value) key.confidence = 'low'; }
  return { start, end: start + seconds, tempo, key, rmsDb: rms ? 20 * Math.log10(rms) : -120,
    silent, clipped: clipping / (samples.length || 1) > .01,
    windows: windows.map(window => ({ ...window, centroid: window.centroid / window.frames, rmsDb: 10 * Math.log10(window.power / window.frames || 1e-12) })) };
}

function quantile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const index = (sorted.length - 1) * fraction, low = Math.floor(index), high = Math.ceil(index);
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}
function cosineDistance(a, b) {
  let dot = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; aa += a[i] ** 2; bb += b[i] ** 2; }
  return aa && bb ? 1 - dot / Math.sqrt(aa * bb) : 0;
}

export function finishAnalysis(raw, duration) {
  const audible = raw.filter(segment => !segment.silent);
  const low = quantile(audible.map(s => s.rmsDb), .1), high = quantile(audible.map(s => s.rmsDb), .9);
  const segments = raw.map(({ windows, ...segment }) => ({ ...segment, energy: segment.silent ? 0 : high - low < 1 ? 50 : Math.round(Math.max(0, Math.min(100, (segment.rmsDb - low) / (high - low) * 100))),
    energyConfidence: segment.silent ? 'unavailable' : 'relative', id: 'audio-' + segment.start }));
  const windows = raw.flatMap(segment => segment.windows);
  const changes = [];
  for (let i = 1; i < windows.length; i++) {
    const a = windows[i - 1], b = windows[i];
    const level = Math.min(1, Math.abs(a.rmsDb - b.rmsDb) / 12);
    const timbre = Math.min(1, Math.abs(Math.log2((a.centroid + 100) / (b.centroid + 100))));
    const harmony = cosineDistance(a.chroma, b.chroma);
    changes.push({ center: b.start, score: .35 * level + .3 * timbre + .35 * harmony, level, timbre, harmony });
  }
  const median = quantile(changes.map(c => c.score), .5);
  const mad = quantile(changes.map(c => Math.abs(c.score - median)), .5);
  const candidates = changes.filter(c => c.center >= 10 && c.center <= duration - 10 && c.score > Math.max(.24, median + 3 * mad)).sort((a, b) => b.score - a.score);
  const transitions = [];
  for (const change of candidates) {
    if (transitions.some(t => Math.abs(t.center - change.center) < 20)) continue;
    transitions.push({ center: change.center, start: Math.max(0, change.center - 7.5), end: Math.min(duration, change.center + 7.5), confidence: 'low',
      reason: 'Change in ' + [change.level > .25 ? 'audio level' : '', change.timbre > .25 ? 'timbre' : '', change.harmony > .2 ? 'tonal content' : ''].filter(Boolean).join(', ') + '; could be a transition, breakdown, drop, or edit.' });
  }
  return { version: ANALYSIS_VERSION, source: 'Uploaded mix audio · analyzed locally', duration, segmentSeconds: SEGMENT_SECONDS, segments,
    transitions: transitions.sort((a, b) => a.start - b.start),
    notes: ['Tempo is estimated from the supplied mix as played, not from a catalog. The detector searches 70–180 BPM and can confuse half/double time.',
      'Key is a spectral-chroma estimate; overlapping tracks, tuning and weak tonal content reduce confidence. Confidence labels are heuristic, not calibrated probabilities.',
      'Relative energy uses segment RMS level normalized to this mix’s 10th–90th percentiles. It is a loudness proxy, not a measure of musical excitement; uniformly loud mixes can be flat.',
      'Likely transition windows are low-confidence audio-change candidates. They do not establish exact blend boundaries and can also mark drops, breaks or edits.'],
  };
}

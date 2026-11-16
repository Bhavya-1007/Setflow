export const MAX_AUDIO_BYTES = 200 * 1024 * 1024;

export async function analyzeAudioFile(file, { signal, onProgress }) {
  if (!file || file.size > MAX_AUDIO_BYTES || !file.size) throw new Error('Choose a nonempty audio file up to 200 MB.');
  if (!/\.(mp3|wav|m4a|ogg|flac|webm|aac)$/i.test(file.name)) throw new Error('Choose MP3, WAV, M4A, OGG, FLAC, WebM audio, or AAC. Browser codec support varies.');
  const check = () => { if (signal.aborted) throw new DOMException('Analysis cancelled.', 'AbortError'); };
  check(); onProgress('Checking audio duration…');
  const duration = await new Promise((resolve, reject) => {
    const audio = new Audio(), url = URL.createObjectURL(file);
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); audio.removeAttribute('src'); audio.load(); URL.revokeObjectURL(url); };
    const abort = () => { cleanup(); reject(new DOMException('Analysis cancelled.', 'AbortError')); };
    const timer = setTimeout(() => { cleanup(); reject(new Error('Could not read audio duration. Try an MP3 or WAV export.')); }, 15000);
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => { const length = audio.duration; cleanup(); resolve(length); };
    audio.onerror = () => { cleanup(); reject(new Error('This browser cannot read the file. Try an MP3 or WAV export.')); };
    signal.addEventListener('abort', abort, { once: true }); audio.src = url;
  });
  if (!Number.isFinite(duration) || duration < 8 || duration > 7200) throw new Error('Choose a finite mix between 8 seconds and 2 hours.');
  check(); onProgress('Decoding audio locally… Large mixes can take time and memory.');
  const context = new OfflineAudioContext(1, 1, 11025);
  let decoded;
  try { decoded = await context.decodeAudioData(await file.arrayBuffer()); }
  catch { throw new Error('Audio decoding failed. Try a smaller MP3 or WAV export supported by this browser.'); }
  check();
  if (decoded.duration > 7200 || decoded.numberOfChannels > 2) throw new Error('Use a mono or stereo mix up to 2 hours.');
  const mono = new Float32Array(decoded.length);
  // Select the louder channel to avoid phase cancellation in stereo DJ recordings.
  let selected = 0, loudest = -1;
  for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
    const samples = decoded.getChannelData(channel); let power = 0;
    for (let i = 0; i < samples.length; i += 100) power += samples[i] ** 2;
    if (power > loudest) { loudest = power; selected = channel; }
  }
  mono.set(decoded.getChannelData(selected)); decoded = null;
  check();
  return new Promise((resolve, reject) => {
    const worker = new Worker('/audio/worker.mjs', { type: 'module' });
    const cleanup = () => { worker.terminate(); signal.removeEventListener('abort', abort); };
    const abort = () => { cleanup(); reject(new DOMException('Analysis cancelled.', 'AbortError')); };
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = ({ data }) => {
      if (data.type === 'progress') onProgress(`Analyzing timestamped segments… ${data.value}%`);
      if (data.type === 'result') { cleanup(); resolve(data.result); }
      if (data.type === 'error') { cleanup(); reject(new Error(data.error)); }
    };
    worker.onerror = () => { cleanup(); reject(new Error('Audio analysis failed. Try a smaller file or another browser.')); };
    worker.postMessage({ samples: mono }, [mono.buffer]);
  });
}

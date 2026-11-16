export function synthMix(seconds = 60, sampleRate = 11025) {
  const samples = new Float32Array(seconds * sampleRate);
  for (let i = 0; i < samples.length; i++) {
    const time = i / sampleRate, second = time >= seconds / 2;
    const bpm = second ? 150 : 120, level = second ? .38 : .1;
    const frequencies = second ? [293.665, 349.228, 440] : [261.626, 329.628, 391.995];
    const pulse = Math.exp(-((time % (60 / bpm))) * 45);
    const chord = frequencies.reduce((sum, frequency) => sum + Math.sin(2 * Math.PI * frequency * time), 0) / 3;
    samples[i] = level * (.65 * chord + .8 * pulse * Math.sin(2 * Math.PI * 80 * time));
  }
  return samples;
}

export function wavBytes(samples, sampleRate = 11025) {
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24); buffer.writeUInt32LE(sampleRate * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36); buffer.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  return buffer;
}

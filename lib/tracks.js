export const MAX_TRACKS = 60;
export const MAX_TRACK_TEXT = 12000;

export function parseTracks(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2 || lines.length > MAX_TRACKS) {
    throw new Error('Enter between 2 and 60 tracks, one per line.');
  }
  return lines.map((line, index) => {
    const [name, bpmText, key, genre, energyText, length, ...extra] = line.split('|').map((part) => part.trim());
    const row = 'Track ' + (index + 1);
    if (!name || name.length > 160 || extra.length || (key?.length ?? 0) > 16 || (genre?.length ?? 0) > 48) {
      throw new Error(row + ' needs a title and up to five optional details.');
    }
    const bpm = bpmText ? Number(bpmText) : null;
    if (bpmText && (!Number.isFinite(bpm) || bpm < 40 || bpm > 260)) {
      throw new Error(row + ' needs a BPM between 40 and 260.');
    }
    const energy = energyText ? Number(energyText) : null;
    if (energyText && (!Number.isInteger(energy) || energy < 1 || energy > 10)) {
      throw new Error(row + ' needs an energy from 1 to 10.');
    }
    let seconds = null;
    if (length) {
      const match = /^(\d{1,2}):([0-5]\d)$/.exec(length);
      if (match) seconds = Number(match[1]) * 60 + Number(match[2]);
      if (!seconds || seconds < 15 || seconds > 1200) {
        throw new Error(row + ' needs a length such as 3:45 (15 seconds to 20 minutes).');
      }
    }
    return { id: index + 1, name, bpm, key: key || '', genre: genre || '', energy, seconds };
  });
}

export function mixTime(seconds) {
  return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
}

export function transitionFor(track, next) {
  if (!next) return '';
  if (track.nextId === next.id && track.transition) return track.transition;
  if (track.bpm && next.bpm && Math.abs(track.bpm - next.bpm) > 8) {
    return 'Try a phrase-end echo out or a breakdown cut to handle the tempo change.';
  }
  return 'Cue the incoming track at the next phrase. Listen for a clean drum section before blending.';
}

export const SAMPLE_TRACKS = [
  'Delhi After Dark | 102 | 6A | Bollywood | 3 | 3:46',
  'Rooftop Radio | 106 | 6A | Bollywood Pop | 4 | 3:36',
  'Lime Soda | 109 | 7A | Desi Pop | 5 | 3:24',
  'Bombay Shuffle | 113 | 7A | Desi House | 5 | 3:40',
  'Midnight Rickshaw | 117 | 8A | Bollywood House | 6 | 3:44',
  'Neon Dhol | 121 | 8A | Desi House | 7 | 3:38',
  'Green Room | 124 | 9A | House | 7 | 3:50',
  'Lights Over Campus | 126 | 9A | EDM | 8 | 3:28',
  'After Hours Anthem | 128 | 10A | EDM | 9 | 3:32',
  'Last Train Home | 128 | 10A | Festival House | 10 | 4:02',
].join('\n');

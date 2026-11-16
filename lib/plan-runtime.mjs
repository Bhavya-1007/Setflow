import { transitionFor } from './tracks.js';

// Run after validating the AI's IDs and clamping its suggested play times.
export function fillPlanRuntime(plan, input) {
  const target = input.targetMinutes * 60;
  const tracks = plan.tracks.map((track) => ({ ...track }));
  const used = new Set(tracks.map((track) => track.id));
  let total = tracks.reduce((sum, track) => sum + track.playSeconds, 0);

  for (const track of tracks) {
    const extra = Math.min(Math.max(0, target - total), (track.seconds ?? 300) - track.playSeconds);
    track.playSeconds += extra;
    total += extra;
  }

  for (const track of input.tracks) {
    if (total >= target) break;
    if (used.has(track.id)) continue;
    const playSeconds = Math.max(15, Math.min(track.seconds ?? 300, target - total));
    tracks.push({
      ...track,
      energy: track.energy ?? 5,
      estimatedEnergy: track.energy == null,
      playSeconds,
      nextId: null,
      transition: '',
    });
    used.add(track.id);
    total += playSeconds;
  }

  // Trim overlong drafts, including a final excerpt rounded up to 15 seconds.
  while (tracks.length > 2 && total - tracks.at(-1).playSeconds >= target) {
    total -= tracks.pop().playSeconds;
  }
  for (let index = tracks.length - 1; index >= 0 && total > target; index--) {
    const reduction = Math.min(total - target, tracks[index].playSeconds - 15);
    tracks[index].playSeconds -= reduction;
    total -= reduction;
  }

  for (let index = 0; index < tracks.length; index++) {
    const next = tracks[index + 1];
    tracks[index].transition = transitionFor(tracks[index], next);
    tracks[index].nextId = next?.id ?? null;
  }

  const notes = [];
  if (total < target) {
    notes.push(`The supplied library is ${Math.ceil((target - total) / 60)} minutes short of the requested runtime.`);
  }
  if (tracks.some((track) => track.seconds == null)) {
    notes.push('Runtime includes estimated excerpts for tracks without supplied lengths; verify their available play time.');
  }
  return { ...plan, tracks, summary: [plan.summary, ...notes].filter(Boolean).join(' ') };
}

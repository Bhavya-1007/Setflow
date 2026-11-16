export function catalogBpmPoints(tracks) {
  const songs = tracks.filter(track => track.status === 'published');
  const points = songs.filter(track => Number.isFinite(track.catalog?.bpm) && track.catalog.bpm > 0)
    .map(track => ({ id: track.id, start: track.start, title: track.title, bpm: track.catalog.bpm }));
  const highest = points.length ? Math.max(...points.map(point => point.bpm)) : null;
  return { total: songs.length, points, highest };
}

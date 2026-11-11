import { requireUser, hasPro } from '@/lib/account';
import { database } from '@/lib/db.mjs';
import { ApiError, apiFailure } from '@/lib/http';
import { readSet } from '@/lib/sets';
import { mixTime, transitionFor } from '@/lib/tracks';

function cell(value) {
  let text = String(value ?? '');
  if (/^\s*[=+\-@]|^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}

export async function GET(request, { params }) {
  try {
    const user = await requireUser();
    if (!hasPro(user)) throw new ApiError(403, 'CSV export is included in SetFlow Pro.');
    const { id } = await params;
    const { title, plan } = await readSet(database(), user.id, id);
    const rows = [
      ['Order', 'Track', 'BPM', 'Key', 'Genre', 'Energy', 'Play time', 'Transition to next'],
      ...plan.tracks.map((track, index) => [
        index + 1, track.name, track.bpm, track.key, track.genre, track.energy,
        mixTime(track.playSeconds), transitionFor(track, plan.tracks[index + 1]),
      ]),
    ];
    const filename = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'setflow-set';
    return new Response('\ufeff' + rows.map((row) => row.map(cell).join(',')).join('\r\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="' + filename + '.csv"',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return apiFailure(error, 'Export set');
  }
}

import { musicRequest } from '@/lib/music/api';
import { MusicError } from '@/lib/music/providers.mjs';
import { searchTracks, recommendTracks } from '@/lib/music/discover.mjs';

export const maxDuration = 60;
export async function POST(request) {
  return musicRequest(request, input => {
    if (input.action === 'search') return searchTracks(input.query);
    if (input.action === 'recommend') return recommendTracks(input.id);
    throw new MusicError(400, 'Choose search or recommendations.');
  });
}

import { musicRequest } from '@/lib/music/api';
import { buildBreakdown } from '@/lib/music/breakdown.mjs';

export const maxDuration = 60;
export async function POST(request) {
  return musicRequest(request, input => buildBreakdown(input));
}

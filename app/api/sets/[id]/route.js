import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/account';
import { database, transaction } from '@/lib/db.mjs';
import { ApiError, apiFailure, checkOrigin, readJson } from '@/lib/http';
import { readSet } from '@/lib/sets';
import { MAX_TRACKS } from '@/lib/tracks';

export async function GET(request, { params }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const set = await readSet(database(), user.id, id);
    return NextResponse.json({ set });
  } catch (error) {
    return apiFailure(error, 'Open set');
  }
}

export async function PATCH(request, { params }) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    const { id } = await params;
    const parsed = z.object({
      trackIds: z.array(z.number().int()).min(2).max(MAX_TRACKS),
      updatedAt: z.string(),
    }).safeParse(await readJson(request, 4096));
    if (!parsed.success) throw new ApiError(400, 'Please provide a valid track order.');
    const { trackIds, updatedAt } = parsed.data;
    const set = await transaction(async (client) => {
      const existing = await readSet(client, user.id, id, true);
      if (existing.updated_at.toISOString() !== updatedAt) {
        throw new ApiError(409, 'This set changed in another tab. Reopen it before saving.');
      }
      const tracks = new Map(existing.plan.tracks.map((track) => [track.id, track]));
      if (trackIds.length !== tracks.size || new Set(trackIds).size !== tracks.size || trackIds.some((key) => !tracks.has(key))) {
        throw new ApiError(400, 'The new order must contain the same tracks.');
      }
      const plan = { ...existing.plan, tracks: trackIds.map((key) => tracks.get(key)) };
      const { rows: [updated] } = await client.query(
        'UPDATE sets SET plan = $1, updated_at = now() WHERE id = $2 ' +
        'RETURNING id, title, vibe, target_minutes, plan, created_at, updated_at',
        [JSON.stringify(plan), id]
      );
      return updated;
    });
    return NextResponse.json({ set });
  } catch (error) {
    return apiFailure(error, 'Save order');
  }
}

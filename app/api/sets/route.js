import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/account';
import { database } from '@/lib/db.mjs';
import { checkOrigin, readJson, ApiError, apiFailure } from '@/lib/http';
import { generatePlan, plannerClient } from '@/lib/ai';
import { planAllowance, reservePlan } from '@/lib/sets';
import { parseTracks, MAX_TRACK_TEXT } from '@/lib/tracks';

export const maxDuration = 60;

const inputSchema = z.object({
  trackText: z.string().trim().min(1).max(MAX_TRACK_TEXT),
  vibe: z.string().trim().min(3).max(500),
  targetMinutes: z.number().int().min(10).max(180),
});

export async function POST(request) {
  let reservedId;
  try {
    checkOrigin(request);
    const user = await requireUser();
    const parsed = inputSchema.safeParse(await readJson(request, 24000));
    if (!parsed.success) throw new ApiError(400, 'Add tracks, an event vibe, and a set length from 10 to 180 minutes.');
    const { trackText, vibe, targetMinutes } = parsed.data;
    let tracks;
    try { tracks = parseTracks(trackText); } catch (error) { throw new ApiError(400, error.message); }

    const ai = plannerClient();
    reservedId = await reservePlan(user.id, vibe, targetMinutes);
    const plan = await generatePlan(ai, { vibe, targetMinutes, tracks });
    const { rows: [set] } = await database().query(
      'UPDATE sets SET title = $1, plan = $2, updated_at = now() WHERE id = $3 ' +
      'RETURNING id, title, vibe, target_minutes, plan, created_at, updated_at',
      [plan.title, JSON.stringify(plan), reservedId]
    );
    return NextResponse.json({ set, allowance: await planAllowance(database(), user) }, { status: 201 });
  } catch (error) {
    if (reservedId) {
      await database().query('DELETE FROM sets WHERE id = $1 AND plan IS NULL', [reservedId]).catch(() => {});
    }
    return apiFailure(error, 'Generate set');
  }
}

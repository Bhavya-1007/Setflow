import { NextResponse } from 'next/server';
import { checkOrigin, readJson, apiFailure } from '../http';
import { MusicError } from './providers.mjs';

const limits = new Map();
export async function musicRequest(request, work) {
  try {
    checkOrigin(request);
    const ip = request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || 'local';
    const now = Date.now();
    const bucket = limits.get(ip);
    if (bucket?.expires > now && bucket.count >= 30) throw new MusicError(429, 'Please wait a minute before trying again.');
    if (!bucket || bucket.expires <= now) {
      if (limits.size >= 1000) limits.delete(limits.keys().next().value);
      limits.set(ip, { count: 1, expires: now + 60000 });
    } else bucket.count++;
    const input = await readJson(request, 40000);
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new MusicError(400, 'Please send a valid request.');
    return NextResponse.json(await work(input));
  } catch (error) {
    if (error instanceof MusicError) return NextResponse.json({ error: error.message }, { status: error.status });
    return apiFailure(error, 'Music lookup');
  }
}

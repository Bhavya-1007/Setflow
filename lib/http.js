import { NextResponse } from 'next/server';
import { SetupError } from './db.mjs';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function checkOrigin(request) {
  const origin = request.headers.get('origin');
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new ApiError(403, 'Please retry from the SetFlow page.');
  }
  if (!origin) return;
  const host = request.headers.get('host') || new URL(request.url).host;
  let originHost;
  try { originHost = new URL(origin).host; } catch { /* A sandboxed origin is invalid here. */ }
  if (originHost !== host) throw new ApiError(403, 'Please retry from the SetFlow page.');
}

export async function readJson(request, maxLength = 20000) {
  if (Number(request.headers.get('content-length')) > maxLength) {
    throw new ApiError(413, 'This request is too large.');
  }
  const body = await request.text();
  if (body.length > maxLength) throw new ApiError(413, 'This request is too large.');
  try {
    return JSON.parse(body);
  } catch {
    throw new ApiError(400, 'Please send a valid request.');
  }
}

export function apiFailure(error, operation) {
  if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof SetupError) return NextResponse.json({ error: error.message }, { status: 503 });
  console.error(operation + ' failed', { type: error?.name, code: error?.code });
  return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
}

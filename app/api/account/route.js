import { NextResponse } from 'next/server';
import { z } from 'zod';
import { database } from '@/lib/db.mjs';
import { hashPassword, verifyPassword } from '@/lib/password.mjs';
import {
  addUser, createSession, rateLimitAccount, removeSession, sessionCookieOptions, SESSION_COOKIE,
} from '@/lib/account';
import { ApiError, apiFailure, checkOrigin, readJson } from '@/lib/http';

const loginFields = {
  email: z.string().trim().toLowerCase().max(254).email(),
  password: z.string().min(1).max(128),
};

const form = z.discriminatedUnion('intent', [
  z.object({ intent: z.literal('login'), ...loginFields }),
  z.object({
    intent: z.literal('signup'),
    ...loginFields,
    password: z.string().min(10).max(128),
    name: z.string().trim().min(1).max(80),
  }),
]);

export async function POST(request) {
  try {
    checkOrigin(request);
    const parsed = form.safeParse(await readJson(request, 4096));
    if (!parsed.success) {
      throw new ApiError(400, 'Enter a valid email. New accounts need a name and a password of at least 10 characters.');
    }

    const { intent, email, password, name } = parsed.data;
    await rateLimitAccount(request, intent, email);

    let user;
    if (intent === 'signup') {
      if (email === 'demo@demo.com') throw new ApiError(409, 'This email already has an account. Log in to continue.');
      user = await addUser(email, name, await hashPassword(password));
      if (!user) throw new ApiError(409, 'This email already has an account. Log in to continue.');
    } else {
      const { rows } = await database().query('SELECT id, password_hash FROM users WHERE email = $1', [email]);
      user = rows[0];
      if (!(await verifyPassword(password, user?.password_hash))) {
        throw new ApiError(401, 'That email or password doesn’t match.');
      }
    }

    const token = await createSession(user.id);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(request));
    return response;
  } catch (error) {
    return apiFailure(error, 'Account request');
  }
}

export async function DELETE(request) {
  try {
    checkOrigin(request);
    await removeSession(request.cookies.get(SESSION_COOKIE)?.value);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, '', sessionCookieOptions(request, true));
    return response;
  } catch (error) {
    return apiFailure(error, 'Sign out');
  }
}

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasVerifiedEmail, rateLimitAccount, requireSessionUser } from '@/lib/account';
import { confirmVerificationCode, sendVerificationCode, verificationCodePattern } from '@/lib/email-verification';
import { ApiError, apiFailure, checkOrigin, readJson } from '@/lib/http';

const form = z.discriminatedUnion('intent', [
  z.object({ intent: z.literal('send') }),
  z.object({ intent: z.literal('verify'), code: z.string().trim().regex(verificationCodePattern) }),
]);

export async function POST(request) {
  try {
    checkOrigin(request);
    const user = await requireSessionUser();
    if (hasVerifiedEmail(user)) return NextResponse.json({ verified: true });

    const parsed = form.safeParse(await readJson(request, 256));
    if (!parsed.success) throw new ApiError(400, 'Paste the full verification code from your email.');
    const { intent, code } = parsed.data;
    await rateLimitAccount(request, 'verify-email-' + intent, user.email);
    if (intent === 'send') {
      await sendVerificationCode(user.id);
      return NextResponse.json({ verified: false });
    }

    await confirmVerificationCode(user.id, code);
    return NextResponse.json({ verified: true });
  } catch (error) {
    return apiFailure(error, 'Email verification');
  }
}

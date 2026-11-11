'use client';

import { useState } from 'react';
import { sendRequest } from '../ui/request';

const sentNotice = { message: 'Verification code sent. Check your inbox.', error: false };
const failedNotice = { message: 'Your account was created. Request a new code to verify your email.', error: true };

export default function VerificationForm({ delivery }) {
  const [notice, setNotice] = useState(delivery === 'sent' ? sentNotice : delivery === 'failed' ? failedNotice : null);
  const [busy, setBusy] = useState('');

  async function run(intent, code) {
    setNotice(null);
    setBusy(intent);
    try {
      if (intent === 'logout') {
        await sendRequest('/api/account', 'DELETE');
        window.location.assign('/login');
        return;
      }
      const { verified } = await sendRequest('/api/account/verify-email', 'POST', { intent, code });
      if (verified) {
        window.location.assign('/studio');
        return;
      }
      setNotice(sentNotice);
    } catch (error) {
      setNotice({ message: error.message, error: true });
    } finally {
      setBusy('');
    }
  }

  function submit(event) {
    event.preventDefault();
    run('verify', new FormData(event.currentTarget).get('code'));
  }

  return (
    <form className="form-stack" onSubmit={submit}>
      {notice && (
        <p className={notice.error ? 'notice notice-error' : 'notice'} role={notice.error ? 'alert' : 'status'}>
          {notice.message}
        </p>
      )}
      <label>
        Verification code
        <input name="code" autoComplete="one-time-code" autoCapitalize="none" spellCheck={false}
          maxLength={32} required />
      </label>
      <button className="button button-primary" disabled={Boolean(busy)}>
        {busy === 'verify' ? 'Verifying…' : 'Verify email'}
      </button>
      <div className="result-actions">
        <button type="button" className="button button-secondary" disabled={Boolean(busy)} onClick={() => run('send')}>
          {busy === 'send' ? 'Sending…' : 'Send a new code'}
        </button>
        <button type="button" className="button button-secondary" disabled={Boolean(busy)} onClick={() => run('logout')}>
          Log out
        </button>
      </div>
    </form>
  );
}

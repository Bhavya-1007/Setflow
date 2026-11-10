'use client';

import { useState } from 'react';
import { sendRequest } from './request';

export default function AccountForm({ signup }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError('');
    setBusy(true);
    try {
      await sendRequest('/api/account', 'POST', {
        intent: signup ? 'signup' : 'login',
        ...Object.fromEntries(form),
      });
      window.location.assign('/studio');
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  }

  return (
    <form className="form-stack" onSubmit={submit}>
      {signup && <label>Name<input name="name" autoComplete="name" maxLength={80} required /></label>}
      <label>Email<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
      <label>
        Password
        <input name="password" type="password" autoComplete={signup ? 'new-password' : 'current-password'}
          minLength={signup ? 10 : undefined} maxLength={128} required />
      </label>
      {signup && <p className="field-help">Use at least 10 characters.</p>}
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      <button className="button button-primary" disabled={busy}>
        {busy ? 'Please wait…' : signup ? 'Create account' : 'Log in'}
      </button>
    </form>
  );
}

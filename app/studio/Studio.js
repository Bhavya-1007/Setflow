'use client';

import { useState } from 'react';
import { sendRequest } from '../ui/request';
import { MAX_TRACK_TEXT, SAMPLE_TRACKS, mixTime, transitionFor } from '@/lib/tracks';

const billingMessages = {
  confirmed: 'Your Pro access is active.',
  cancelled: 'You returned from checkout. Your saved sets are here.',
  pending: 'Stripe is confirming your payment. Refresh this page in a moment.',
};

export default function Studio({ initialSets, initialAllowance, billing, testCheckout }) {
  const [trackText, setTrackText] = useState('');
  const [vibe, setVibe] = useState('');
  const [targetMinutes, setTargetMinutes] = useState(30);
  const [savedSets, setSavedSets] = useState(initialSets);
  const [allowance, setAllowance] = useState(initialAllowance);
  const [activeSet, setActiveSet] = useState(null);
  const [order, setOrder] = useState([]);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState(billingMessages[billing] || '');
  const [error, setError] = useState('');

  const dirty = Boolean(activeSet && order.some((track, index) => track.id !== activeSet.plan.tracks[index].id));

  function showSet(set) {
    setActiveSet(set);
    setOrder(set.plan.tracks);
  }

  async function run(action, work) {
    setError('');
    setMessage('');
    setBusy(action);
    try {
      await work();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy('');
    }
  }

  async function generate(event) {
    event.preventDefault();
    await run('generate', async () => {
      const result = await sendRequest('/api/sets', 'POST', { trackText, vibe, targetMinutes: Number(targetMinutes) });
      showSet(result.set);
      setAllowance(result.allowance);
      setSavedSets((sets) => [result.set, ...sets]);
      setMessage('Your set is saved. Adjust the order as you practice.');
    });
  }

  async function openSet(id) {
    if (dirty && !window.confirm('Open another set and discard the unsaved order?')) return;
    await run('open', async () => {
      const result = await sendRequest('/api/sets/' + id);
      showSet(result.set);
    });
  }

  function moveTrack(index, offset) {
    setOrder((tracks) => {
      const moved = [...tracks];
      const neighbor = index + offset;
      [moved[index], moved[neighbor]] = [moved[neighbor], moved[index]];
      return moved;
    });
  }

  async function saveOrder() {
    await run('save', async () => {
      const { set } = await sendRequest('/api/sets/' + activeSet.id, 'PATCH', {
        trackIds: order.map((track) => track.id),
        updatedAt: activeSet.updated_at,
      });
      showSet(set);
      setMessage('Track order saved.');
    });
  }

  async function upgrade() {
    await run('checkout', async () => {
      const result = await sendRequest('/api/billing/checkout', 'POST');
      if (result.active) {
        window.location.reload();
      } else {
        window.location.assign(result.url);
      }
    });
  }

  async function logout() {
    await run('logout', async () => {
      await sendRequest('/api/account', 'DELETE');
      window.location.assign('/login');
    });
  }

  return (
    <>
      <div className="studio-intro">
        <div>
          <p className="eyebrow"><span /> SETFLOW STUDIO</p>
          <h1>Plan your set.</h1>
          <p className="subtext">Start with the tracks you know. Find an order that fits the room.</p>
        </div>
        <div className="studio-actions">
          {!allowance.pro && (
            <button className="button button-primary" type="button" onClick={upgrade} disabled={Boolean(busy)}>
              {busy === 'checkout' ? 'Opening Stripe…' : 'Upgrade to Pro'}
            </button>
          )}
          <button className="button button-secondary" type="button" onClick={logout} disabled={Boolean(busy)}>
            Log out
          </button>
        </div>
      </div>

      {testCheckout && !allowance.pro && <p className="test-caption">Stripe test checkout · $10/month Pro</p>}
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      {message && <p className="notice" role="status">{message}</p>}

      <div className="studio-grid">
        <div className="studio-inputs">
          <section className="app-card">
            <div className="card-heading"><h2>Track library</h2><span className="small-tag">01 / INPUT</span></div>
            <form className="form-stack" onSubmit={generate}>
              <div className="field-heading">
                <label htmlFor="track-text">Your tracks</label>
                <button className="text-button" type="button" disabled={Boolean(busy)} onClick={() => {
                  setTrackText(SAMPLE_TRACKS);
                  setVibe('College party. Start with Bollywood, build into house, and finish with high-energy EDM.');
                  setTargetMinutes(30);
                }}>Load sample tracks</button>
              </div>
              <textarea id="track-text" rows={8} maxLength={MAX_TRACK_TEXT} required value={trackText}
                onChange={(event) => setTrackText(event.target.value)}
                placeholder={'One track per line\nSong title | BPM | key | genre | energy | length'} />
              <p className="field-help">Paste 2–60 tracks. Titles alone work. Add optional details in the order shown, with energy from 1–10 and length like 3:45.</p>
              <label>Event and vibe
                <input value={vibe} onChange={(event) => setVibe(event.target.value)} maxLength={500}
                  placeholder="College party, Bollywood into EDM" required />
              </label>
              <label>Set length in minutes
                <input type="number" min={10} max={180} required value={targetMinutes}
                  onChange={(event) => setTargetMinutes(event.target.value)} />
              </label>
              <button className="button button-primary" disabled={Boolean(busy) || !allowance.remaining}>
                {busy === 'generate' ? 'Planning your set…' : 'Generate set'}
              </button>
              <p className="field-help" aria-live="polite">
                {allowance.pro ? allowance.remaining + ' Pro generations available in the current 24-hour window.'
                  : allowance.remaining ? '1 free set available.' : 'Free set used. Pro unlocks more sets and CSV export.'}
              </p>
            </form>
          </section>

          <section className="app-card saved-card">
            <div className="card-heading"><h2>Saved sets</h2><span className="small-tag">{savedSets.length}</span></div>
            {savedSets.length ? (
              <ul className="saved-list">
                {savedSets.map((set) => (
                  <li key={set.id}>
                    <button type="button" className={activeSet?.id === set.id ? 'saved-active' : ''}
                      onClick={() => openSet(set.id)} disabled={Boolean(busy)}>
                      <strong>{set.title}</strong><span>{set.target_minutes} min target</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <p className="subtext">Generated sets will appear here.</p>}
          </section>
        </div>

        <section className="app-card result-card" aria-label="Set preview" aria-busy={busy === 'generate'}>
          {activeSet ? (
            <SetResult set={activeSet} order={order} moveTrack={moveTrack} dirty={dirty} busy={busy}
              saveOrder={saveOrder} pro={allowance.pro} />
          ) : (
            <div className="empty-result">
              <div className="empty-wave" aria-hidden="true">
                {[15, 24, 33, 22, 44, 63, 46, 67, 52, 34, 44, 29, 19].map((height, index) =>
                  <span key={index} style={{ height }} />
                )}
              </div>
              <h2>{busy === 'generate' ? 'Building your set…' : 'Your set will appear here.'}</h2>
              <p>{busy === 'generate'
                ? 'SetFlow is sequencing your tracks and working out the transitions.'
                : 'Add your tracks or load the sample library to see the order, energy curve, and transition notes.'}</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function SetResult({ set, order, moveTrack, dirty, busy, saveOrder, pro }) {
  const totalSeconds = order.reduce((sum, track) => sum + track.playSeconds, 0);
  const lengthDifference = totalSeconds - set.target_minutes * 60;
  const tolerance = Math.max(120, set.target_minutes * 9);

  return (
    <>
      <div className="card-heading"><span className="small-tag">02 / YOUR SET</span><span className="small-tag">{order.length} TRACKS</span></div>
      <h2 className="set-title">{set.title}</h2>
      <p className="subtext">{set.plan.summary}</p>
      <div className="set-metrics"><span>Estimated play time <strong>{mixTime(totalSeconds)}</strong></span><span>Target <strong>{set.target_minutes} min</strong></span></div>
      {lengthDifference < -tolerance && <p className="field-help">This sequence is short of the target. Add more tracks for a longer set.</p>}
      {lengthDifference > tolerance && <p className="field-help">This sequence runs over the target. Shorten some excerpts while mixing.</p>}

      <div className="energy-panel">
        <h3>Energy curve</h3>
        <div className="energy-bars" aria-hidden="true">
          {order.map((track) => <span key={track.id} style={{ height: (track.energy * 10) + '%' }} />)}
        </div>
        <div className="energy-labels"><span>Start</span><span>Finish</span></div>
      </div>

      <div className="order-heading">
        <h3>Track order</h3>
        {dirty && <span className="field-help">Unsaved order</span>}
      </div>
      <ol className="track-list">
        {order.map((track, index) => {
          const next = order[index + 1];
          const note = transitionFor(track, next);
          return (
            <li key={track.id}>
              <div className="track-line">
                <span className="track-number">{String(index + 1).padStart(2, '0')}</span>
                <div className="track-info">
                  <strong>{track.name}</strong>
                  <div className="track-meta">
                    {track.bpm && <span>{track.bpm} BPM</span>}
                    {track.key && <span>{track.key}</span>}
                    {track.genre && <span>{track.genre}</span>}
                    <span>{track.estimatedEnergy ? 'Est. energy' : 'Energy'} {track.energy}/10</span>
                    <span>{mixTime(track.playSeconds)} play time</span>
                  </div>
                </div>
                <div className="track-controls">
                  <button type="button" aria-label={'Move ' + track.name + ' up'} onClick={() => moveTrack(index, -1)}
                    disabled={index === 0 || Boolean(busy)}>↑</button>
                  <button type="button" aria-label={'Move ' + track.name + ' down'} onClick={() => moveTrack(index, 1)}
                    disabled={index === order.length - 1 || Boolean(busy)}>↓</button>
                </div>
              </div>
              {note && <p className="transition-note"><span>{track.nextId === next?.id && track.transition ? 'AI transition' : 'Mix cue'}</span>{note}</p>}
            </li>
          );
        })}
      </ol>
      <div className="result-actions">
        <button className="button button-primary" type="button" disabled={!dirty || Boolean(busy)} onClick={saveOrder}>
          {busy === 'save' ? 'Saving…' : 'Save order'}
        </button>
        {pro && !dirty && <a className="button button-secondary" href={'/api/sets/' + set.id + '/csv'}>Export CSV</a>}
        {pro && dirty && <span className="field-help">Save the new order to export it.</span>}
        {!pro && <span className="field-help">CSV export is included in Pro.</span>}
      </div>
    </>
  );
}

'use client';
import { useState } from 'react';
import { sendRequest } from '../ui/request';
import MusicLinks from '../ui/MusicLinks';
import { secondsLabel } from '@/lib/music/providers.mjs';

function TrackInfo({ track }) {
  return <div className="music-track-info">
    {track.artwork ? <img className="album-cover" src={track.artwork} alt="" width="64" height="64" /> : <span className="album-placeholder" aria-hidden="true">♫</span>}
    <div><h3>{track.title}</h3><p>{track.artist}</p><small>{track.album}{track.duration ? ` · ${secondsLabel(track.duration)}` : ''}{track.releaseDate ? ` · ${track.releaseDate}` : ''}</small></div>
  </div>;
}

function Listen({ track }) {
  const [failed, setFailed] = useState(false);
  return <>
    {track.preview && !failed ? <div className="preview-player"><span>Preview · Deezer</span><audio controls preload="none" src={track.preview} aria-label={`Preview ${track.title} by ${track.artist}`} onError={() => setFailed(true)} onPlay={event => {
      document.querySelectorAll('audio').forEach(audio => { if (audio !== event.currentTarget) audio.pause(); });
    }} /></div> : <p className="field-help">{failed ? 'This preview is unavailable. Use a listening link below.' : 'No preview available. Open a listening link below.'}</p>}
    <MusicLinks links={track.links} />
  </>;
}

export default function Discover() {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  async function find(event) {
    event.preventDefault(); setBusy('search'); setError(''); setResult(null); setSearch(null);
    try { setSearch(await sendRequest('/api/discover', 'POST', { action: 'search', query })); }
    catch (failure) { setError(failure.message); } finally { setBusy(''); }
  }
  async function select(track) {
    setBusy(track.id); setError(''); setResult(null);
    try { setResult(await sendRequest('/api/discover', 'POST', { action: 'recommend', id: track.id })); }
    catch (failure) { setError(failure.message); } finally { setBusy(''); }
  }
  return <>
    <div className="studio-intro"><div><p className="eyebrow"><span /> DISCOVER YOUR NEXT TRACK</p><h1>Keep the feeling going.</h1><p className="subtext">Start with one song. Find a few directions for your next mix.</p></div><span className="small-tag">01 / DISCOVER</span></div>
    <section className="app-card music-search">
      <form className="form-stack" onSubmit={find}>
        <label htmlFor="song-query">Song title and artist, or a song link</label>
        <div className="music-search-row"><input id="song-query" value={query} onChange={event => setQuery(event.target.value)} maxLength={500} required placeholder="e.g. One More Time — Daft Punk" /><button className="button button-primary" disabled={Boolean(busy)}>{busy === 'search' ? 'Searching…' : 'Find a song ↗'}</button></div>
        <p className="field-help">Supports Deezer and Spotify track links, and YouTube song videos. Choose the exact recording before discovering more.</p>
      </form>
    </section>
    {error && <p className="notice notice-error" role="alert">{error}</p>}
    <div aria-live="polite" role="status" className="field-help">{busy && busy !== 'search' ? 'Finding related songs and checking available metadata…' : ''}</div>
    {result ? <div className="discover-grid">
      <aside className="app-card seed-card"><p className="small-tag">YOUR STARTING POINT</p><TrackInfo track={result.seed} /><div className="metadata-chips"><span>{result.seed.bpm ? `${result.seed.bpm} BPM · catalog` : 'BPM unavailable'}</span><span>Key unavailable</span></div><Listen track={result.seed} /><button type="button" className="text-button" onClick={() => setResult(null)}>← Choose another version</button></aside>
      <section aria-label="Next-track suggestions"><div className="card-heading"><h2>Try these next.</h2><span className="small-tag">{result.recommendations.length} IDEAS</span></div><p className="subtext">{result.method}</p>
        {!result.recommendations.length && <p className="notice">No related songs were returned for this artist. Try another recording.</p>}
        <div className="suggestion-list">{result.recommendations.map((track, index) => <article className="app-card suggestion" key={track.id}><span className="suggestion-number">{String(index + 1).padStart(2, '0')}</span><TrackInfo track={track} /><div className="metadata-chips"><span>{track.bpm ? `${track.bpm} BPM · catalog` : 'BPM unavailable'}</span><span>Key unavailable</span></div><ul className="fit-reasons">{track.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul><p className="field-help">{track.mixNote}</p><Listen track={track} /></article>)}</div>
      </section>
    </div> : search ? <section className="app-card"><div className="card-heading"><h2>Choose your version.</h2><span className="small-tag">{search.tracks.length} MATCHES</span></div><p className="subtext">{search.note}</p>
      {search.tracks.length ? <ul className="version-list">{search.tracks.map(track => <li key={track.id}><TrackInfo track={track} /><button type="button" className="button button-secondary" disabled={Boolean(busy)} onClick={() => select(track)} aria-label={`Select ${track.title} by ${track.artist} from ${track.album}`}>{busy === track.id ? 'Finding ideas…' : 'Use this version →'}</button></li>)}</ul> : <p className="notice">No catalog matches. Try the title and artist, or use a different spelling.</p>}
    </section> : !busy && <section className="app-card music-empty"><div className="music-orbit" aria-hidden="true">↗</div><h2>A good next track starts here.</h2><p className="subtext">Search a favorite, choose its version, then audition real songs from a related artist radio.</p><p className="field-help">Catalog matches and listening links. No invented tracks or musical keys.</p></section>}
  </>;
}

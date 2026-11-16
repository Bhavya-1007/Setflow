'use client';
import { useState } from 'react';
import { sendRequest } from '../ui/request';
import MusicLinks from '../ui/MusicLinks';
import { secondsLabel } from '@/lib/music/providers.mjs';

const statusLabels = { published: 'Posted track cue', unidentified: 'Unidentified', ambiguous: 'Ambiguous overlap', unparsed: 'Artist / title unconfirmed', section: 'Posted section' };

export function MetricCurve({ tracks, duration, metric, title, onSeek }) {
  const known = tracks.filter(track => Number.isFinite(track[metric]));
  const min = metric === 'energy' ? 1 : Math.floor(Math.min(...known.map(track => track[metric]), 120) / 10) * 10 - 10;
  const max = metric === 'energy' ? 10 : Math.ceil(Math.max(...known.map(track => track[metric]), 130) / 10) * 10 + 10;
  const x = track => 40 + track.start / duration * 720;
  const y = track => 100 - (track[metric] - min) / (max - min) * 75;
  return <section className="metric-curve"><div className="card-heading"><h3>{title}</h3><span className="small-tag">{known.length} CUES WITH DATA</span></div>
    {known.length ? <svg viewBox="0 0 800 130" role="img" aria-label={`${title}; gaps mean unavailable data. Values are listed in each track row.`}>
      {[min, max].map(value => <g key={value}><line x1="40" x2="760" y1={value === min ? 100 : 25} y2={value === min ? 100 : 25} className="curve-guide" /><text x="2" y={value === min ? 104 : 29}>{value}</text></g>)}
      {tracks.map((track, index) => Number.isFinite(track[metric]) && <g key={track.id}>
        {index > 0 && Number.isFinite(tracks[index - 1][metric]) && <line x1={x(tracks[index - 1])} y1={y(tracks[index - 1])} x2={x(track)} y2={y(track)} className="curve-line" strokeDasharray={metric === 'energy' && track.estimatedEnergy ? '5 4' : undefined} />}
        <circle cx={x(track)} cy={y(track)} r="4" className="curve-point"><title>{secondsLabel(track.start)} · {track.title}: {track[metric]}{track.estimatedEnergy && metric === 'energy' ? ' (tempo-only estimate)' : ''}</title></circle>
      </g>)}
      <text x="40" y="126">0:00</text><text x="760" y="126" textAnchor="end">{secondsLabel(duration)}</text>
    </svg> : <p className="curve-empty">No {metric === 'bpm' ? 'BPM' : 'energy'} data available. No curve has been invented.</p>}
    {known.length > 0 && <div className="curve-cues">{known.map(track => <button className="text-button" key={track.id} onClick={() => onSeek(track.start)}>{secondsLabel(track.start)} · {track[metric]}{metric === 'energy' && track.estimatedEnergy ? ' est.' : ''}</button>)}</div>}
  </section>;
}

export default function Breakdown() {
  const [url, setUrl] = useState('');
  const [tracklist, setTracklist] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cue, setCue] = useState({ seconds: 0, count: 0 });
  async function analyze(event) {
    event.preventDefault(); setBusy(true); setError(''); setResult(null); setCue({ seconds: 0, count: 0 });
    try { setResult(await sendRequest('/api/set-breakdown', 'POST', { url, tracklist })); }
    catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  function seek(seconds) { setCue(previous => ({ seconds, count: previous.count + 1 })); }
  const extent = result?.video.duration || Math.max(60, ...(result?.tracks.map(track => track.start + 1) || []));
  return <>
    <div className="studio-intro"><div><p className="eyebrow"><span /> LISTEN. TRACE. LEARN.</p><h1>See how a set unfolds.</h1><p className="subtext">Explore posted track cues. Follow the music, with the evidence in view.</p></div><span className="small-tag">02 / SET BREAKDOWN</span></div>
    <section className="app-card music-search"><form className="form-stack" onSubmit={analyze}>
      <label htmlFor="set-url">Public YouTube DJ-set link</label><div className="music-search-row"><input type="url" id="set-url" value={url} onChange={event => setUrl(event.target.value)} required maxLength={500} placeholder="https://www.youtube.com/watch?v=…" /><button className="button button-primary" disabled={busy}>{busy ? 'Reading posted cues…' : 'Break down set ↗'}</button></div>
      <details className="tracklist-input"><summary>Have a tracklist from a comment or another source?</summary><label htmlFor="posted-tracklist">Paste the tracklist (optional)</label><textarea id="posted-tracklist" value={tracklist} onChange={event => setTracklist(event.target.value)} maxLength={30000} rows={6} placeholder={'0:00 Artist - Track title\n5:30 Artist - Track title (Remix)\n10:00 ID - ID'} /><p className="field-help">Pasted text replaces the description tracklist and is labelled user-supplied. Use artist – title with timestamps; explicit “transition” ranges are supported.</p></details>
      <p className="field-help">Uses the video’s published description. No audio recognition, and no guessed blend boundaries.</p>
    </form></section>
    {error && <p className="notice notice-error" role="alert">{error}</p>}
    {busy && <p className="notice" role="status">Reading the video description and checking catalog matches. This can take a moment.</p>}
    {result ? <div className="breakdown-results">
      <div className="card-heading"><div><h2>{result.video.title}</h2><p className="subtext">{result.video.author} · {result.video.duration ? secondsLabel(result.video.duration) : 'Duration unavailable'}</p></div><a href={result.video.url} className="quiet-link" target="_blank" rel="noopener noreferrer">Open on YouTube ↗</a></div>
      <div className="breakdown-top"><div><iframe key={`${result.video.id}-${cue.count}`} className="set-player" title={result.video.title} src={`https://www.youtube-nocookie.com/embed/${result.video.id}?start=${cue.seconds}&autoplay=${cue.count ? 1 : 0}`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /><p className="field-help" role="status">Cue: {secondsLabel(cue.seconds)}. If the uploader disables embedding, <a className="inline-link" href={`${result.video.url}&t=${cue.seconds}s`} target="_blank" rel="noopener noreferrer">open this moment on YouTube</a>.</p></div>
        <aside className="app-card evidence-card"><p className="small-tag">WHAT WE CAN VERIFY</p><div className="breakdown-stats"><div><strong>{result.publishedCount}</strong><span>posted track cues</span></div><div><strong>{result.transitions.length}</strong><span>explicit blend ranges</span></div></div><p className="subtext">Source: {result.source}</p><p className="field-help">Named entries reflect the posted tracklist, not audio identification. Coverage between cues is unverified.</p>{result.noTracklist && <p className="notice">No identifiable timestamped tracklist found in the checked source. Unidentified sections remain visible. You can paste a tracklist above.</p>}</aside></div>
      <section className="app-card timeline-card"><div className="card-heading"><h2>The shape of the set.</h2><span className="small-tag">CLICK A CUE TO LISTEN</span></div>
        <p className="field-help">Blocks run between posted cues; they are not measured track durations or blend lengths. Striped sections are unidentified or ambiguous.</p>
        <div className="timeline-scroll"><div className="set-timeline" aria-label="Track cue timeline">{result.tracks.map(track => <button type="button" key={track.id} className={`timeline-block ${track.status === 'published' ? 'known' : track.status === 'section' ? 'section' : 'unknown'} ${cue.seconds === track.start ? 'selected' : ''}`} style={{ flex: Math.max(1, (track.end ?? extent) - track.start) }} title={`${secondsLabel(track.start)} · ${track.artist ? track.artist + ' — ' : ''}${track.title}`} aria-label={`Jump to ${secondsLabel(track.start)}: ${track.title}`} onClick={() => seek(track.start)}><span>{secondsLabel(track.start)}</span></button>)}</div></div>
        <div className="energy-labels"><span>0:00</span><span>{result.video.duration ? secondsLabel(extent) : 'Last known cue (duration unknown)'}</span></div>
        <div className="timeline-legend"><span>● Posted cue</span><span>▧ Unidentified / unconfirmed</span><span>○ Other posted section</span></div>
        <MetricCurve tracks={result.tracks} duration={extent} metric="bpm" title="BPM across posted cues" onSeek={seek} />
        <MetricCurve tracks={result.tracks} duration={extent} metric="energy" title="Energy across posted cues" onSeek={seek} />
        <p className="field-help">BPM is source or recording metadata, not measured set tempo. Dashed energy lines / “est.” values are a tempo-only proxy (70–180 BPM mapped to 1–10), not measured loudness or intensity. Gaps stay blank.</p>
      </section>
      <section className="app-card"><div className="card-heading"><h2>Tracklist & entry cues</h2><span className="small-tag">CHRONOLOGICAL</span></div><ol className="breakdown-tracklist">{result.tracks.map(track => <li key={track.id} className={cue.seconds === track.start ? 'cue-active' : ''}><button type="button" className="cue-button" onClick={() => seek(track.start)} aria-label={`Play ${track.title} at ${secondsLabel(track.start)}`}>▶ {secondsLabel(track.start)}</button><div className="cue-content"><span className={`evidence-tag ${track.status !== 'published' ? 'uncertain' : ''}`}>{statusLabels[track.status]}</span><h3>{track.title}</h3><p className="subtext">{track.artist || (track.status === 'section' ? 'Non-track section' : 'Artist not identified')}</p><div className="metadata-chips"><span title={track.bpmSource || ''}>{track.bpm ? `${track.bpm} BPM · ${track.bpmSource?.startsWith('Deezer') ? 'catalog' : 'posted'}` : 'BPM unavailable'}</span><span>{track.key ? `Key ${track.key} · posted` : 'Key unavailable'}</span><span>{track.energy !== null ? `Energy ${track.energy}/10 · ${track.estimatedEnergy ? 'tempo estimate' : 'posted'}` : 'Energy unavailable'}</span></div><MusicLinks links={track.links} />{track.evidence && <details className="cue-evidence"><summary>View source text</summary><p>{track.source}</p><blockquote>{track.evidence}</blockquote></details>}</div></li>)}</ol></section>
      <section className="app-card"><h2>Transition evidence</h2>{result.transitions.length ? <ul className="transition-evidence">{result.transitions.map((transition, index) => <li key={index}><button className="text-button" onClick={() => seek(transition.start)}>{secondsLabel(transition.start)}–{secondsLabel(transition.end)}</button> · {transition.text}<p className="field-help">Posted range · {transition.source}. Not independently measured.</p></li>)}</ul> : <p className="subtext">No explicit blend ranges were found. Track entry cues are shown above; exact mix-in and mix-out points remain unknown.</p>}</section>
      <details className="app-card limitations"><summary>Sources, estimates & gaps</summary><ul>{[...result.notes, ...result.warnings].map(note => <li key={note}>{note}</li>)}</ul><p className="field-help">Audio recognition would require a supported audio source and a separately configured recognition service. It is not enabled.</p></details>
    </div> : !busy && <section className="app-card music-empty"><div className="empty-timeline" aria-hidden="true"><i /><i /><i /><i /><i /></div><h2>Every set has a story.</h2><p className="subtext">Paste a public YouTube set to explore its published tracklist and jump between moments.</p><p className="field-help">If no tracklist is available, we show the gap instead of filling it with guesses.</p></section>}
  </>;
}

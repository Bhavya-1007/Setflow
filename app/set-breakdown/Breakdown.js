'use client';
import { useEffect, useRef, useState } from 'react';
import { sendRequest } from '../ui/request';
import MusicLinks from '../ui/MusicLinks';
import { secondsLabel } from '@/lib/music/providers.mjs';
import { catalogBpmPoints } from '@/lib/music/catalog-curve.mjs';
import { analyzeAudioFile } from '@/lib/music/audio-client';

const statusLabels = { published: 'Posted track cue', unidentified: 'Unidentified', ambiguous: 'Ambiguous overlap', unparsed: 'Artist / title unconfirmed', section: 'Posted section' };

function CatalogBpmCurve({ tracks, duration, onSeek }) {
  const { points, total, highest } = catalogBpmPoints(tracks);
  const min = Math.floor(Math.min(...points.map(point => point.bpm), 120) / 10) * 10 - 10;
  const max = Math.ceil(Math.max(...points.map(point => point.bpm), 130) / 10) * 10 + 10;
  const x = point => 40 + point.start / duration * 720;
  const y = point => 100 - (point.bpm - min) / (max - min) * 75;
  return <section className="metric-curve catalog-bpm-curve"><h3>Catalog BPM across posted cues</h3>
    <p className="field-help">Catalog BPM available for {points.length} of {total} tracks.</p>
    {points.length ? <>
      <svg viewBox="0 0 800 130" role="img" aria-label="Catalog BPM at posted track timestamps. Missing values are blank; these are not measured playback tempos.">
        {[min, max].map(value => <g key={value}><line x1="40" x2="760" y1={value === min ? 100 : 25} y2={value === min ? 100 : 25} className="curve-guide" /><text x="2" y={value === min ? 104 : 29}>{value}</text></g>)}
        {points.map(point => <circle key={point.id} cx={x(point)} cy={y(point)} r={point.bpm === highest ? 7 : 4} stroke={point.bpm === highest ? '#fff' : undefined} strokeWidth="2" className="curve-point"><title>{secondsLabel(point.start)} · {point.title}: {point.bpm} BPM{point.bpm === highest ? ' · Highest catalog BPM found' : ''}</title></circle>)}
        <text x="40" y="126">0:00</text><text x="760" y="126" textAnchor="end">{secondsLabel(duration)}</text>
      </svg>
      <p><strong>Highest catalog BPM found</strong> · {highest} BPM</p>
      <div className="curve-cues">{points.map(point => <button className="text-button" key={point.id} onClick={() => onSeek(point.start)}>{secondsLabel(point.start)} · {point.title} · {point.bpm} BPM</button>)}</div>
    </> : <p className="curve-empty">No catalog BPM available</p>}
    <p className="field-help">Recording metadata, not measured set tempo. Missing values stay blank.</p>
  </section>;
}

function Curve({ segments, duration, metric, title }) {
  const value = segment => metric === 'tempo' ? segment.tempo.value : segment.energy;
  const known = segments.filter(segment => value(segment) !== null && !segment.silent);
  const min = metric === 'tempo' ? 60 : 0, max = metric === 'tempo' ? 190 : 100;
  const x = segment => 40 + segment.start / duration * 720;
  const y = segment => 105 - (value(segment) - min) / (max - min) * 80;
  return <section className="metric-curve"><div className="card-heading"><h3>{title}</h3><span className="small-tag">FROM MIX AUDIO</span></div>
    {!known.length ? <p className="curve-empty">No reliable {metric === 'tempo' ? 'tempo' : 'energy'} measurements. No curve has been invented.</p> : <>
      <svg viewBox="0 0 800 135" role="img" aria-label={`${title}. Segment values and confidence are in the table below. Gaps represent unavailable data.`}>
        {[min, max].map(v => <g key={v}><line x1="40" x2="760" y1={v === min ? 105 : 25} y2={v === min ? 105 : 25} className="curve-guide" /><text x="2" y={v === min ? 109 : 29}>{v}</text></g>)}
        {segments.map((segment, index) => value(segment) !== null && !segment.silent && <g key={segment.id}>
          {index > 0 && value(segments[index - 1]) !== null && !segments[index - 1].silent && <line x1={x(segments[index - 1])} y1={y(segments[index - 1])} x2={x(segment)} y2={y(segment)} className="curve-line" strokeDasharray={metric === 'tempo' && segment.tempo.confidence === 'low' ? '5 4' : undefined} />}
          <circle className="curve-point" cx={x(segment)} cy={y(segment)} r="4"><title>{secondsLabel(segment.start)}: {value(segment)} {metric === 'tempo' ? `BPM · ${segment.tempo.confidence} confidence` : '/100 relative energy'}</title></circle>
        </g>)}
        <text x="40" y="132">0:00</text><text x="760" y="132" textAnchor="end">{secondsLabel(duration)}</text>
      </svg>
      <p className="field-help">Click any segment below to listen. {metric === 'tempo' ? 'Dashed lines indicate low confidence. Half/double-time tempo is possible.' : 'Relative RMS audio level within this file; not catalog energy or musical excitement.'}</p>
    </>}
  </section>;
}

function AudioResults({ analysis, result, aligned, offset, seek }) {
  function label(segment) {
    if (!aligned || !result) return 'Track unknown';
    const time = segment.start + offset;
    const track = result.tracks.filter(row => row.start <= time).at(-1);
    if (!track || track.status !== 'published') return 'Track unknown';
    const crosses = result.tracks.some(row => row.start > time && row.start < segment.end + offset);
    return `${track.artist} — ${track.title}${crosses ? ' / cue change within segment' : ''} · posted label`;
  }
  return <section className="app-card audio-results" aria-label="Mix audio analysis">
    <div className="card-heading"><h2>Inside the mix.</h2><span className="small-tag">{analysis.segments.length} AUDIO SEGMENTS</span></div>
    <p className="subtext">{analysis.source} · {secondsLabel(analysis.duration)} · {analysis.segmentSeconds}-second segments</p>
    <p className="field-help">{aligned ? `Video alignment supplied by you: file 0:00 = video ${secondsLabel(offset)}. Posted names are labels, not audio identifications.` : 'Analysis is independent of track names. Enable video alignment above only if this is the same recording.'}</p>
    <div className="audio-segment-strip" aria-label="Audio segment timeline">{analysis.segments.map(segment => <button key={segment.id} onClick={() => seek(segment.start)} aria-label={`Listen to audio segment ${secondsLabel(segment.start)}`} title={`${secondsLabel(segment.start)} · ${label(segment)}`} style={{ opacity: segment.silent ? .35 : .5 + segment.energy / 200 }}><span>{secondsLabel(segment.start)}</span></button>)}</div>
    <Curve segments={analysis.segments} duration={analysis.duration} metric="tempo" title="BPM as played · audio estimate" />
    <Curve segments={analysis.segments} duration={analysis.duration} metric="energy" title="Relative energy curve" />
    <h3>Likely transition windows</h3>
    <p className="field-help">Low-confidence candidates based on level, timbre and tonal changes—not measured blend boundaries. Drops and breakdowns can look similar.</p>
    {analysis.transitions.length ? <ul className="transition-evidence">{analysis.transitions.map(window => <li key={window.start}><button className="text-button" onClick={() => seek(window.start)}>{secondsLabel(window.start)}–{secondsLabel(window.end)}</button><span className="evidence-tag uncertain"> · Low confidence</span><p className="field-help">{window.reason}</p></li>)}</ul> : <p className="subtext">No strong change windows found. Smooth blends may not be detected.</p>}
    <div className="audio-table-scroll"><table className="audio-table"><caption>Audio measurements by segment; unknown songs retain their measurements</caption><thead><tr><th>File time</th><th>Track label</th><th>BPM as played</th><th>Estimated key</th><th>Relative energy</th></tr></thead><tbody>{analysis.segments.map(segment => <tr key={segment.id}><td><button className="text-button" onClick={() => seek(segment.start)}>{secondsLabel(segment.start)}–{secondsLabel(segment.end)}</button>{aligned && <small>Video {secondsLabel(segment.start + offset)}</small>}</td><td>{label(segment)}{segment.clipped && <small>Clipping detected</small>}</td><td title={segment.tempo.reason}>{segment.tempo.value ?? 'Unavailable'}<small>{segment.tempo.confidence === 'unavailable' ? segment.tempo.reason : `${segment.tempo.confidence} confidence${segment.tempo.alternative ? ` · alternative ${segment.tempo.alternative}` : ''}`}</small></td><td title={segment.key.reason}>{segment.key.value || 'Unavailable'}<small>{segment.key.confidence === 'unavailable' ? segment.key.reason : `${segment.key.confidence} confidence`}</small></td><td>{segment.silent ? 'Unavailable · low signal' : `${segment.energy}/100`}<small>{segment.rmsDb.toFixed(1)} dBFS RMS</small></td></tr>)}</tbody></table></div>
    <details className="limitations"><summary>How these measurements work</summary><ul>{analysis.notes.map(note => <li key={note}>{note}</li>)}</ul></details>
  </section>;
}

export default function Breakdown() {
  const [url, setUrl] = useState(''), [tracklist, setTracklist] = useState('');
  const [result, setResult] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [cue, setCue] = useState({ seconds: 0, count: 0 });
  const [file, setFile] = useState(null), [fileUrl, setFileUrl] = useState(''), [analysis, setAnalysis] = useState(null);
  const [audioBusy, setAudioBusy] = useState(false), [audioError, setAudioError] = useState(''), [progress, setProgress] = useState('');
  const [aligned, setAligned] = useState(false), [offset, setOffset] = useState(0);
  const audioRef = useRef(null), abortRef = useRef(null), job = useRef(0);
  useEffect(() => () => { job.current++; abortRef.current?.abort(); }, []);
  useEffect(() => () => { if (fileUrl) URL.revokeObjectURL(fileUrl); }, [fileUrl]);
  function clearAudio() { job.current++; abortRef.current?.abort(); setAudioBusy(false); setProgress(''); setAnalysis(null); setAudioError(''); }
  async function analyze(event) {
    event.preventDefault(); clearAudio(); setFile(null); setFileUrl(''); setAligned(false); setOffset(0);
    setBusy(true); setError(''); setResult(null); setCue({ seconds: 0, count: 0 });
    try { setResult(await sendRequest('/api/set-breakdown', 'POST', { url, tracklist })); }
    catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  async function analyzeFile() {
    clearAudio(); const id = ++job.current; const controller = new AbortController(); abortRef.current = controller;
    setAudioBusy(true);
    try {
      const measured = await analyzeAudioFile(file, { signal: controller.signal, onProgress: text => { if (job.current === id) setProgress(text); } });
      if (job.current === id) setAnalysis(measured);
    } catch (failure) { if (job.current === id && failure.name !== 'AbortError') setAudioError(failure.message); }
    finally { if (job.current === id) { setAudioBusy(false); setProgress(''); } }
  }
  const extent = result?.video.duration || Math.max(1, ...(result?.tracks.map(track => track.start) || []));
  function seekVideo(seconds) { audioRef.current?.pause(); setCue(previous => ({ seconds: Math.floor(seconds), count: previous.count + 1 })); }
  function seekAudio(seconds) {
    if (audioRef.current) audioRef.current.currentTime = seconds;
    if (aligned && result) { audioRef.current?.pause(); seekVideo(seconds + Number(offset)); }
    else audioRef.current?.play().catch(() => setAudioError('Press Play on the audio player to listen.'));
  }
  return <>
    <div className="studio-intro"><div><p className="eyebrow"><span /> LISTEN. MEASURE. LEARN.</p><h1>See how a set unfolds.</h1><p className="subtext">Analyze the mix audio. Keep its musical shape visible—even when the songs are unknown.</p></div><span className="small-tag">02 / SET BREAKDOWN</span></div>
    <section className="app-card music-search"><form className="form-stack" onSubmit={analyze}>
      <label htmlFor="set-url">Public YouTube DJ-set URL</label><div className="music-search-row"><input type="url" id="set-url" value={url} onChange={event => setUrl(event.target.value)} required maxLength={500} placeholder="https://www.youtube.com/watch?v=…" /><button className="button button-primary" disabled={busy || audioBusy}>{busy ? 'Checking link…' : 'Analyze'}</button></div>
      <p className="field-help">Checks audio access and available track labels. Link-only audio analysis is not currently connected; a mix file is required for measurements.</p>
      <details className="tracklist-input"><summary>Optional posted tracklist</summary><label htmlFor="posted-tracklist">Track labels and timestamps</label><textarea id="posted-tracklist" value={tracklist} onChange={event => setTracklist(event.target.value)} maxLength={30000} rows={5} placeholder={'0:00 Artist - Track\n5:30 Artist - Track (Remix)'} /><p className="field-help">Labels only. Posted or catalog values will never be used as mix-audio measurements.</p></details>
    </form></section>
    {error && <p className="notice notice-error" role="alert">{error}</p>}
    {busy && <p className="notice" role="status">Checking this link and its published description…</p>}
    {result?.audioAccess && <section className="notice audio-access" role="status"><h2>Link-only audio is unavailable</h2><p>{result.audioAccess.message}</p><p>{result.audioAccess.coverage}</p><p>{result.audioAccess.fallback}</p></section>}
    <section className="app-card audio-upload"><div className="card-heading"><h2>{result ? 'Analyze a mix file instead.' : 'Or analyze a mix file.'}</h2><span className="small-tag">LOCAL AUDIO ANALYSIS</span></div><p className="subtext">Choose audio you’re permitted to use. The file stays on your device. MP3, WAV, M4A, OGG, FLAC, AAC or WebM audio; up to 200 MB and 2 hours, subject to browser codec and memory support.</p>
      <div className="form-stack"><label htmlFor="mix-audio">Mix audio file<input key={result?.video.id || 'file-only'} id="mix-audio" type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac,.aac,.webm" disabled={busy} onChange={event => { clearAudio(); const selected = event.target.files?.[0] || null; setFile(selected); setFileUrl(selected ? URL.createObjectURL(selected) : ''); setAligned(false); }} /></label>
        {fileUrl && <audio ref={audioRef} controls preload="metadata" src={fileUrl} aria-label="Uploaded mix audio" />}
        {file && result && <><label className="audio-alignment"><input type="checkbox" checked={aligned} onChange={event => setAligned(event.target.checked)} />This file is the same recording as the video; use its posted labels and jump in the video.</label>{aligned && <label>Video time corresponding to the file start (seconds)<input type="number" min="0" max="86400" step="1" value={offset} onChange={event => setOffset(Math.max(0, Math.min(86400, Number(event.target.value) || 0)))} /></label>}</>}
        <div className="result-actions"><button className="button button-primary" type="button" onClick={analyzeFile} disabled={!file || busy || audioBusy}>{audioBusy ? 'Analyzing audio…' : 'Analyze file'}</button>{audioBusy && <button className="button button-secondary" onClick={clearAudio}>Cancel analysis</button>}</div>
      </div>
      {progress && <p className="notice" role="status">{progress}</p>}{audioError && <p className="notice notice-error" role="alert">{audioError}</p>}
    </section>
    {analysis && !result && <AudioResults analysis={analysis} result={result} aligned={aligned} offset={Number(offset)} seek={seekAudio} />}
    {result && <div className="breakdown-results">
      <div className="card-heading"><div><h2>{result.video.title}</h2><p className="subtext">{result.video.author} · {result.video.duration ? secondsLabel(result.video.duration) : 'Video duration unavailable'}</p></div><a href={result.video.url} className="quiet-link" target="_blank" rel="noopener noreferrer">Open on YouTube ↗</a></div>
      <div className="breakdown-top"><div><iframe key={`${result.video.id}-${cue.count}`} className="set-player" title={result.video.title} src={`https://www.youtube-nocookie.com/embed/${result.video.id}?start=${cue.seconds}&autoplay=${cue.count ? 1 : 0}`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /><p className="field-help" role="status">Video cue: {secondsLabel(cue.seconds)} · <a className="inline-link" href={`${result.video.url}&t=${cue.seconds}s`} target="_blank" rel="noopener noreferrer">Open this moment on YouTube</a> if embedding is restricted.</p></div><aside className="app-card evidence-card"><p className="small-tag">TRACK LABELS · NOT AUDIO ANALYSIS</p><div className="breakdown-stats"><div><strong>{result.publishedCount}</strong><span>posted track cues</span></div></div><p className="subtext">{result.source}</p><p className="field-help">Track names are optional labels. They neither supply audio nor prove blend boundaries.</p>{result.noTracklist === true && <p className="notice">No identifiable tracklist in the checked source. Audio-file measurements still work with unknown song names.</p>}{result.warnings.map(warning => <p key={warning} className="field-help">{warning}</p>)}</aside></div>
      <section className="app-card timeline-card"><div className="card-heading"><h2>The shape of the set.</h2><span className="small-tag">CLICK A CUE TO LISTEN</span></div>
        <p className="field-help">{result.video.duration ? "Timeline covers the video duration." : "Timeline covers the posted cues only; video duration is unavailable."}</p><p className="field-help">Blocks run between posted cues; they are not measured track durations or blend lengths. Striped sections are unidentified or ambiguous.</p>
        <div className="timeline-scroll"><div className="set-timeline" aria-label="Track cue timeline">{result.tracks.map(track => <button type="button" key={track.id} className={`timeline-block ${track.status === 'published' ? 'known' : track.status === 'section' ? 'section' : 'unknown'} ${cue.seconds === track.start ? 'selected' : ''}`} style={{ flex: Math.max(1, (track.end ?? extent) - track.start) }} title={`${secondsLabel(track.start)} · ${track.artist ? track.artist + ' — ' : ''}${track.title}`} aria-label={`Jump to ${secondsLabel(track.start)}: ${track.title}`} onClick={() => seekVideo(track.start)}><span>{secondsLabel(track.start)}</span></button>)}</div></div>
        <div className="energy-labels"><span>0:00</span><span>{result.video.duration ? secondsLabel(extent) : 'Posted cues only (duration unknown)'}</span></div>
        <div className="timeline-legend"><span>● Posted cue</span><span>▧ Unidentified / unconfirmed</span><span>○ Other posted section</span></div>
        <CatalogBpmCurve tracks={result.tracks} duration={extent} onSeek={seekVideo} />
      </section>
      {analysis && <AudioResults analysis={analysis} result={result} aligned={aligned} offset={Number(offset)} seek={seekAudio} />}
      <details className="app-card" open><summary>Published track labels & catalog metadata</summary><ol className="breakdown-tracklist">{result.tracks.map(track => <li key={track.id}><button className="cue-button" onClick={() => seekVideo(track.start)} aria-label={`Play ${track.title} at ${secondsLabel(track.start)}`}>▶ {secondsLabel(track.start)}</button><div className="cue-content"><span className={`evidence-tag ${track.status !== 'published' ? 'uncertain' : ''}`}>{statusLabels[track.status]}</span><h3>{track.title}</h3><p className="subtext">{track.artist || 'Artist not identified'}</p>{Boolean(track.bpm || track.key) && <div className="metadata-chips">{Boolean(track.bpm) && <span title="Recording or posted metadata, not measured set tempo">{`${track.bpm} BPM · ${track.bpmSource?.startsWith('Deezer') ? 'Catalog' : 'Posted'}`}</span>}{track.key && <span title="Posted metadata, not measured from audio">{`Key ${track.key} · Posted`}</span>}</div>}<MusicLinks links={track.links} />{track.evidence && <details className="cue-evidence"><summary>View source text</summary><blockquote>{track.evidence}</blockquote></details>}</div></li>)}</ol></details>
    </div>}
  </>;
}

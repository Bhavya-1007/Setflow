const waveHeights = [
  12, 21, 15, 29, 20, 36, 25, 45, 32, 51, 39, 60, 43, 68, 51, 75,
  58, 84, 65, 91, 72, 100, 79, 92, 70, 83, 63, 75, 53, 68, 47, 59,
  39, 51, 32, 44, 25, 35, 20, 27, 15, 21, 11,
];

function FlowMark({ small = false }) {
  return (
    <svg
      className={small ? 'flow-mark small' : 'flow-mark'}
      width="30"
      height="30"
      viewBox="0 0 30 30"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 12v6M9.5 7v16M15 3v24M20.5 7v16M26 12v6"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SetIllustration() {
  return (
    <div className="set-illustration" aria-hidden="true">
      <div className="orbit orbit-outer" />
      <div className="orbit orbit-inner" />
      <div className="orbit-dot" />

      <div className="record">
        <div className="record-center">
          <FlowMark />
          <span>FIND YOUR FLOW</span>
          <i />
        </div>
      </div>

      <div className="key-chip">
        <span className="chip-symbol">♯</span>
        <div><span className="chip-label">IN HARMONY</span><strong>8A <span>→</span> 9A</strong></div>
      </div>

      <div className="bpm-chip">
        <span className="tempo-icon"><i /><i /><i /></span>
        <div><span className="chip-label">ON THE BEAT</span><strong>126 <span>BPM</span></strong></div>
      </div>

      <div className="wave-card">
        <div className="wave-heading">
          <span><i /> THE ENERGY OF A GREAT SET</span>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="m3 12 4-4 3 2 5-6M11 4h4v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="waveform">
          {waveHeights.map((height, index) => (
            <i key={index} style={{ height: `${height}%` }} />
          ))}
        </div>
        <div className="wave-labels"><span>WARM UP</span><span>BUILD</span><span>PEAK TIME</span></div>
      </div>

      <span className="illustration-caption">A LITTLE STRUCTURE. A LOT OF FEELING.</span>
    </div>
  );
}

export default function Home() {
  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="#home" aria-label="SetFlow home">
          <FlowMark />
          <span>SetFlow<span className="brand-period">.</span></span>
        </a>
        <div className="development-status"><span /> In development</div>
      </header>

      <main id="home">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <div className="eyebrow"><span /> AI DJ SET PLANNER</div>
            <h1 id="hero-title">
              <span>Your tracks.</span>{' '}
              <span>Your crowd.</span>{' '}
              <span className="accent">Your perfect set.</span>
            </h1>
            <p className="description">
              SetFlow will help DJs turn their songs into setlists that flow.
              Organize by genre, BPM, musical key, and energy—with suggested
              transitions to bring it all together.
            </p>
            <ul className="track-attributes" aria-label="Setlist planning criteria">
              <li>Genre</li><li>BPM</li><li>Musical key</li><li>Energy</li>
            </ul>
            <p className="coming-soon"><span className="coming-arrow">↗</span> Less time sorting. More time mixing.<span className="coming-detail">Currently in development.</span></p>
          </div>
          <SetIllustration />
        </section>
      </main>

      <footer className="site-footer">
        <span className="footer-note"><FlowMark small /> Built around your sound.</span>
        <span className="creator">Created by <strong>Bhavya Poddar</strong></span>
      </footer>
    </div>
  );
}

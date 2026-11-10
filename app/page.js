import Brand, { FlowMark } from './ui/Brand';

const waveHeights = [
  12, 21, 15, 29, 20, 36, 25, 45, 32, 51, 39, 60, 43, 68, 51, 75,
  58, 84, 65, 91, 72, 100, 79, 92, 70, 83, 63, 75, 53, 68, 47, 59,
  39, 51, 32, 44, 25, 35, 20, 27, 15, 21, 11,
];

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
        <Brand />
        <nav className="header-actions" aria-label="Account">
          <a className="quiet-link" href="/login">Log in</a>
          <a className="button button-primary header-cta" href="/signup">Try SetFlow</a>
        </nav>
      </header>

      <main id="home" className="landing-main">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <div className="eyebrow"><span /> AI DJ SET PLANNER</div>
            <h1 id="hero-title">
              <span>Your tracks.</span>{' '}
              <span>Your crowd.</span>{' '}
              <span className="accent">Your perfect set.</span>
            </h1>
            <p className="description">
              SetFlow helps student and beginner DJs plan sets from tracks they already own.
              Paste your songs, describe the crowd, and get a track order with an energy curve
              and suggestions for each transition.
            </p>
            <ul className="track-attributes" aria-label="Setlist planning criteria">
              <li>Genre</li><li>BPM</li><li>Musical key</li><li>Energy</li>
            </ul>
            <div className="hero-actions">
              <a className="button button-primary" href="/signup">Plan a free set <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 12 12 4M5 4h7v7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></a>
              <a className="quiet-link" href="#pricing">See pricing</a>
            </div>
            <p className="course-status"><span /> In development</p>
          </div>
          <SetIllustration />
        </section>
        <section className="pricing-section" id="pricing" aria-labelledby="pricing-title">
          <div>
            <p className="eyebrow"><span /> SETFLOW PLANS</p>
            <h2 id="pricing-title">Start with your next set.</h2>
            <p>Try it on a real gig. Keep your set saved, adjust the order as you practice, and take it with you when you upgrade.</p>
          </div>
          <div className="price-card">
            <p className="price-label">FREE</p>
            <p className="price">$0</p>
            <p>Generate one set with an editable track order, energy curve, and transition notes.</p>
            <a className="button button-secondary" href="/signup">Try a free set</a>
          </div>
          <div className="price-card price-pro">
            <p className="price-label">SETFLOW PRO</p>
            <p className="price">$10 <span>/ month</span></p>
            <p>Plan more sets for different gigs and export your track order and notes as a CSV.</p>
            <a className="button button-primary" href="/signup">Get started</a>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <span className="footer-note"><FlowMark small /> Built around your sound.</span>
        <span className="creator">Created by <strong>Bhavya Poddar</strong></span>
      </footer>
    </div>
  );
}

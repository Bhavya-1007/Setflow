export function FlowMark({ small = false }) {
  return (
    <svg
      className={small ? 'flow-mark small' : 'flow-mark'}
      width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true"
    >
      <path
        d="M4 12v6M9.5 7v16M15 3v24M20.5 7v16M26 12v6"
        stroke="currentColor" strokeWidth="3" strokeLinecap="round"
      />
    </svg>
  );
}

export default function Brand() {
  return (
    <a className="brand" href="/" aria-label="SetFlow home">
      <FlowMark />
      <span>SetFlow<span className="brand-period">.</span></span>
    </a>
  );
}

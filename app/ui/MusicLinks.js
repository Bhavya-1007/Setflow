export default function MusicLinks({ links }) {
  return <div className="music-links">{links.map(link => <a key={link.platform} href={link.url} target="_blank" rel="noopener noreferrer">
    {link.platform}{link.kind === 'search' ? ' · Search' : link.kind === 'published' ? ' · Posted link' : ' ↗'}
  </a>)}</div>;
}

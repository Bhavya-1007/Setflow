import Link from 'next/link';

export default function StudioNav({ active }) {
  return <nav className="studio-tabs" aria-label="SetFlow tools">
    {[['planner', '/studio', 'Set Planner'], ['discover', '/discover', 'Discover'], ['breakdown', '/set-breakdown', 'Set Breakdown']].map(([id, href, name]) =>
      <Link key={id} href={href} aria-current={active === id ? 'page' : undefined}>{name}</Link>)}
  </nav>;
}

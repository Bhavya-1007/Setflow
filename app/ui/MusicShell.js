import Brand from './Brand';
import StudioNav from './StudioNav';

export default function MusicShell({ active, children }) {
  return <div className="site-shell studio-shell">
    <header className="site-header"><Brand /><a className="quiet-link" href="/studio">My studio ↗</a></header>
    <StudioNav active={active} />
    <main className="studio-main music-main">{children}</main>
    <footer className="site-footer"><span>SetFlow · Find your flow</span><span>Created by Bhavya Poddar</span></footer>
  </div>;
}

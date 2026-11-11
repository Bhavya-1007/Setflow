import { redirect } from 'next/navigation';
import { currentUser, hasVerifiedEmail } from '@/lib/account';
import { database } from '@/lib/db.mjs';
import { listSets, planAllowance } from '@/lib/sets';
import { checkoutIsTest } from '@/lib/billing';
import Brand from '../ui/Brand';
import Studio from './Studio';

export const metadata = { title: 'Studio | SetFlow' };

export default async function StudioPage({ searchParams }) {
  const user = await currentUser();
  if (!user) redirect('/login');
  if (!hasVerifiedEmail(user)) redirect('/verify-email');
  const [savedSets, allowance, query] = await Promise.all([
    listSets(user.id),
    planAllowance(database(), user),
    searchParams,
  ]);

  return (
    <div className="site-shell studio-shell">
      <header className="site-header">
        <Brand />
        <div className="header-actions">
          <span className="studio-user">{user.name}</span>
          <span className="plan-badge">{user.is_demo ? 'Demo · Pro' : allowance.pro ? 'Pro' : 'Free'}</span>
        </div>
      </header>
      <main className="studio-main">
        <Studio initialSets={savedSets} initialAllowance={allowance} billing={query?.billing}
          testCheckout={Boolean(checkoutIsTest())} />
      </main>
      <footer className="site-footer"><span>SetFlow Studio</span><span>Created by Bhavya Poddar</span></footer>
    </div>
  );
}

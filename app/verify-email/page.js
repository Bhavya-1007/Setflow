import { redirect } from 'next/navigation';
import { currentUser, hasVerifiedEmail } from '@/lib/account';
import Brand from '../ui/Brand';
import VerificationForm from './VerificationForm';

export const metadata = { title: 'Verify your email | SetFlow' };

export default async function VerifyEmailPage({ searchParams }) {
  const user = await currentUser();
  if (!user) redirect('/login');
  if (hasVerifiedEmail(user)) redirect('/studio');
  const { delivery } = await searchParams;

  return (
    <div className="site-shell account-shell">
      <header className="site-header"><Brand /></header>
      <main className="account-main">
        <section className="app-card account-card">
          <p className="eyebrow"><span /> SETFLOW STUDIO</p>
          <h1>Verify your email.</h1>
          <p className="subtext">Use a one-time code to confirm <strong>{user.email}</strong> and open your Studio.</p>
          <VerificationForm delivery={delivery} />
        </section>
      </main>
      <footer className="site-footer"><span>SetFlow</span><span>Created by Bhavya Poddar</span></footer>
    </div>
  );
}

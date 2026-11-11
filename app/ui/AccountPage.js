import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/account';
import Brand from './Brand';
import AccountForm from './AccountForm';

export default async function AccountPage({ signup }) {
  if (await currentUser()) redirect('/studio');
  return (
    <div className="site-shell account-shell">
      <header className="site-header">
        <Brand />
        <a className="quiet-link" href={signup ? '/login' : '/signup'}>{signup ? 'Log in' : 'Sign up'}</a>
      </header>
      <main className="account-main">
        <section className="app-card account-card">
          <p className="eyebrow"><span /> SETFLOW STUDIO</p>
          <h1>{signup ? 'Plan your first set.' : 'Welcome back.'}</h1>
          <p className="subtext">
            {signup ? 'Create an account to generate and save your free set.' : 'Log in to open your saved sets and plan the next one.'}
          </p>
          <AccountForm signup={signup} />
          <p className="account-switch">
            {signup ? 'Already have an account? ' : 'New to SetFlow? '}
            <a href={signup ? '/login' : '/signup'}>{signup ? 'Log in' : 'Create an account'}</a>
          </p>
        </section>
      </main>
      <footer className="site-footer"><span>SetFlow</span><span>Created by Bhavya Poddar</span></footer>
    </div>
  );
}

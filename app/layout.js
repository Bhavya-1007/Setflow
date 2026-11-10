import './globals.css';

export const metadata = {
  title: 'SetFlow — AI DJ Set Planner',
  description:
    'Plan a DJ set from your tracks. Get an editable track order, energy curve, and transition notes for your next gig. Created by Bhavya Poddar.',
  icons: { icon: '/icon.svg' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

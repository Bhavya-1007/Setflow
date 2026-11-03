import './globals.css';

export const metadata = {
  title: 'SetFlow — AI DJ Set Planner',
  description:
    'SetFlow is an AI DJ set planner in development. Organize songs by genre, BPM, musical key, and energy, with suggested transitions. Created by Bhavya Poddar.',
  icons: { icon: '/icon.svg' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

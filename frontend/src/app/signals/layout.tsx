import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Trading Signals',
  description: 'Real-time trading signals from your subscribed strategies with instant notifications and detailed entry/exit information.',
  robots: 'noindex,nofollow',
};

export default function SignalsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

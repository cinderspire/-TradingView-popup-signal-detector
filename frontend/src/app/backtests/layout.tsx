import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Backtests',
  description: 'View historical backtesting results for strategies and analyze past performance data.',
  robots: 'noindex,nofollow',
};

export default function BacktestsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Provider Leaderboard',
  description: 'Compare top signal providers ranked by performance, win rate, and subscriber satisfaction. Find the best traders to follow and copy their strategies.',
  keywords: ['provider leaderboard', 'top traders', 'best signal providers', 'trading rankings', 'provider performance', 'win rate ranking'],
  openGraph: {
    title: 'Provider Leaderboard | AutomatedTradeBot',
    description: 'Compare top signal providers ranked by performance. Find the best traders to follow.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Provider Leaderboard | AutomatedTradeBot',
    description: 'Top signal providers ranked by performance and win rate.',
  },
};

export default function LeaderboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Marketplace',
  description: 'Explore trending strategies and top-performing signal providers in our trading marketplace. Discover profitable trading opportunities with free trials.',
  keywords: ['trading marketplace', 'trending strategies', 'popular signals', 'marketplace trading', 'strategy marketplace'],
  openGraph: {
    title: 'Marketplace | AutomatedTradeBot',
    description: 'Explore trending strategies and top-performing providers.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Marketplace | AutomatedTradeBot',
    description: 'Trending strategies and top providers.',
  },
};

export default function MarketplaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

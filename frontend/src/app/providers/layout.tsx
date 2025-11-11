import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Signal Providers',
  description: 'Explore verified signal providers and their trading strategies. Compare performance metrics, subscriber reviews, and start following top traders with free trials.',
  keywords: ['signal providers', 'trading providers', 'expert traders', 'verified providers', 'top traders', 'forex providers', 'crypto providers'],
  openGraph: {
    title: 'Signal Providers | AutomatedTradeBot',
    description: 'Explore verified signal providers. Compare performance and start following top traders.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Signal Providers | AutomatedTradeBot',
    description: 'Explore verified signal providers and top traders.',
  },
};

export default function ProvidersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

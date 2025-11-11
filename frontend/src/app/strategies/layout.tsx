import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Trading Strategies',
  description: 'Browse verified trading strategies with transparent performance metrics. Start free trials and subscribe to profitable strategies from expert providers.',
  keywords: ['trading strategies', 'forex strategies', 'crypto strategies', 'profitable trading', 'strategy marketplace', 'verified signals', 'free trial trading'],
  openGraph: {
    title: 'Trading Strategies | AutomatedTradeBot',
    description: 'Browse verified trading strategies with transparent performance metrics. Start with 14-day free trials.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Trading Strategies | AutomatedTradeBot',
    description: 'Browse verified trading strategies. Start with 14-day free trials.',
  },
};

export default function StrategiesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

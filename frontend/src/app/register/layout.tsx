import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign Up',
  description: 'Create your free AutomatedTradeBot account and start following profitable trading strategies today. Get 14-day free trials on all strategies.',
  keywords: ['sign up', 'create account', 'register trading', 'free account', 'trading signup'],
  robots: 'noindex,nofollow',
  openGraph: {
    title: 'Sign Up | AutomatedTradeBot',
    description: 'Create your free account. Start with 14-day free trials.',
    type: 'website',
  },
};

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Login',
  description: 'Sign in to your AutomatedTradeBot account to access your dashboard, subscriptions, and trading signals.',
  robots: 'noindex,nofollow',
  openGraph: {
    title: 'Login | AutomatedTradeBot',
    description: 'Sign in to access your trading dashboard.',
    type: 'website',
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

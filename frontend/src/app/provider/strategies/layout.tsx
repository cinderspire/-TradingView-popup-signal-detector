import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Strategies',
  description: 'Manage your published trading strategies and performance.',
  robots: 'noindex,nofollow',
};

export default function ProviderStrategiesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

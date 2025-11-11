import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Provider Analytics',
  description: 'Advanced analytics for your strategies and subscriber engagement.',
  robots: 'noindex,nofollow',
};

export default function ProviderAnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

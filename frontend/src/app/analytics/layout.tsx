import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Analytics',
  description: 'Advanced trading analytics and performance insights for your portfolio with detailed charts and metrics.',
  robots: 'noindex,nofollow',
};

export default function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

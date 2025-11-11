import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Provider Dashboard',
  description: 'Manage your strategies, track subscribers, and monitor your performance as a signal provider.',
  robots: 'noindex,nofollow',
};

export default function ProviderDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

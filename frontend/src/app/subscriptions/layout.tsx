import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Subscriptions',
  description: 'Manage your strategy subscriptions, track performance, view trial status, and manage active positions for all your followed traders.',
  robots: 'noindex,nofollow',
};

export default function SubscriptionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

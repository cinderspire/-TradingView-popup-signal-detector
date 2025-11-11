import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Subscribers',
  description: 'View and manage your strategy subscribers.',
  robots: 'noindex,nofollow',
};

export default function ProviderSubscribersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

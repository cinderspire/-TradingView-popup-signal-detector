import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Profile',
  description: 'Manage your trading profile and account settings.',
  robots: 'noindex,nofollow',
};

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Notifications',
  description: 'Manage your trading notifications and alerts.',
  robots: 'noindex,nofollow',
};

export default function NotificationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

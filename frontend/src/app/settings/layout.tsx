import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Configure your account settings and preferences.',
  robots: 'noindex,nofollow',
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

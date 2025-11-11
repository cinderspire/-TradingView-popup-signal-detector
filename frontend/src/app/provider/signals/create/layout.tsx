import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create Signal',
  description: 'Broadcast new trading signals to your subscribers.',
  robots: 'noindex,nofollow',
};

export default function CreateSignalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

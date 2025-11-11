import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Positions',
  description: 'View and manage all your open and closed trading positions with detailed P&L analytics and performance tracking.',
  robots: 'noindex,nofollow',
};

export default function PositionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

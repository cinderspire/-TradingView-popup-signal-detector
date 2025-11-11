import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Transactions',
  description: 'View your transaction history and subscription payments with detailed billing information.',
  robots: 'noindex,nofollow',
};

export default function TransactionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

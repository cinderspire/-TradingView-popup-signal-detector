import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Risk Management',
  description: 'Configure your risk management settings including position sizing, stop loss, and take profit rules for safe trading.',
  robots: 'noindex,nofollow',
};

export default function RiskManagementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

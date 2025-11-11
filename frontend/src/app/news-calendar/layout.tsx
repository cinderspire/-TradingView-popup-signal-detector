import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Economic Calendar',
  description: 'Stay updated with important economic events and news that impact the markets.',
  keywords: ['economic calendar', 'market news', 'trading events', 'economic news'],
  openGraph: {
    title: 'Economic Calendar | AutomatedTradeBot',
    description: 'Important economic events and market news.',
  },
};

export default function NewsCalendarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

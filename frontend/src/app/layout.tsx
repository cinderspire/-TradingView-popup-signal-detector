import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/hooks/useAuth'
import { Navigation } from '@/components/layout/Navigation'
import { OrganizationSchema, WebSiteSchema } from '@/components/seo/StructuredData'
import { ErrorBoundary } from '@/components/ErrorBoundary'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://automatedtradebot.com'),
  title: {
    default: 'AutomatedTradeBot - Trading Signal Marketplace',
    template: '%s | AutomatedTradeBot',
  },
  description: 'Discover profitable trading strategies from verified providers. Start with 14-day free trials, track real-time performance, and copy trade with confidence. Professional trading signal marketplace with advanced risk management.',
  keywords: [
    'trading signals',
    'forex signals',
    'crypto signals',
    'copy trading',
    'automated trading',
    'signal marketplace',
    'trading strategies',
    'free trial trading',
    'verified providers',
    'real-time analytics',
  ],
  authors: [{ name: 'AutomatedTradeBot' }],
  creator: 'AutomatedTradeBot',
  publisher: 'AutomatedTradeBot',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://automatedtradebot.com',
    siteName: 'AutomatedTradeBot',
    title: 'AutomatedTradeBot - Trading Signal Marketplace',
    description: 'Discover profitable trading strategies from verified providers. Start with 14-day free trials and copy trade with confidence.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'AutomatedTradeBot Trading Signal Marketplace',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AutomatedTradeBot - Trading Signal Marketplace',
    description: 'Professional trading signal marketplace with real-time analytics and copy trading',
    creator: '@automatedtradebot',
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: 'https://automatedtradebot.com',
  },
  verification: {
    google: 'your-google-verification-code',
    // yandex: 'your-yandex-verification-code',
    // bing: 'your-bing-verification-code',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <OrganizationSchema />
        <WebSiteSchema />
      </head>
      <body className={inter.className}>
        <ErrorBoundary>
          <AuthProvider>
            <Navigation />
            {children}
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}

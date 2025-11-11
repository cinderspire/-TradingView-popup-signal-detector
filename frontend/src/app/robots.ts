import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard',
          '/subscriptions',
          '/positions',
          '/signals',
          '/profile',
          '/settings',
          '/risk-management',
          '/analytics',
          '/backtests',
          '/notifications',
          '/transactions',
          '/provider/dashboard',
          '/provider/signals',
          '/provider/strategies',
          '/provider/subscribers',
          '/provider/analytics',
        ],
      },
    ],
    sitemap: 'https://automatedtradebot.com/sitemap.xml',
  }
}

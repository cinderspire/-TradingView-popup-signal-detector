// AutomatedTradeBot - Dynamic Sitemap
// Generates XML sitemap for search engines
// Learn more: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap

import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://automatedtradebot.com';
  const currentDate = new Date();

  return [
    // Home Page - Highest Priority
    {
      url: baseUrl,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 1.0,
    },

    // Main Public Pages - High Priority (Updated Frequently)
    {
      url: `${baseUrl}/strategies`,
      lastModified: currentDate,
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/providers`,
      lastModified: currentDate,
      changeFrequency: 'hourly',
      priority: 0.9,
    },

    // Secondary Public Pages - Medium-High Priority
    {
      url: `${baseUrl}/leaderboard`,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/marketplace`,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 0.8,
    },

    // Authentication Pages - Lower Priority (Static Content)
    {
      url: `${baseUrl}/login`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/register`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.5,
    },

    // Note: Private pages (dashboard, subscriptions, etc.) are excluded
    // as they require authentication and should not be indexed

    // Future Enhancement: Add dynamic strategy and provider pages
    // Example:
    // {
    //   url: `${baseUrl}/strategies/${strategy.id}`,
    //   lastModified: strategy.updatedAt,
    //   changeFrequency: 'daily',
    //   priority: 0.7,
    // },
  ];
}

// For dynamic content (strategies, providers), fetch from API:
// export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
//   const strategies = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/strategies`).then(res => res.json());
//
//   const strategyUrls = strategies.map((strategy: any) => ({
//     url: `${baseUrl}/strategies/${strategy.id}`,
//     lastModified: new Date(strategy.updatedAt),
//     changeFrequency: 'daily',
//     priority: 0.7,
//   }));
//
//   return [...staticUrls, ...strategyUrls];
// }

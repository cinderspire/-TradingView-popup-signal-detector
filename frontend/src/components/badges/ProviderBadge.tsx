'use client';

import React from 'react';

export type BadgeType = 
  | 'TOP_PERFORMER'
  | 'VERIFIED'
  | 'HOT_THIS_WEEK'
  | 'CONSISTENT_TRADER'
  | 'HALL_OF_FAME'
  | 'NEW_PROVIDER'
  | 'RISING_STAR';

export interface Badge {
  type: BadgeType;
  label: string;
  icon: string;
  color: string;
  bgColor: string;
  description: string;
}

export const BADGE_DEFINITIONS: Record<BadgeType, Badge> = {
  TOP_PERFORMER: {
    type: 'TOP_PERFORMER',
    label: 'Top Performer',
    icon: '🥇',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
    description: 'Top 3 provider this period'
  },
  VERIFIED: {
    type: 'VERIFIED',
    label: 'Verified',
    icon: '✓',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    description: 'Verified trading provider'
  },
  HOT_THIS_WEEK: {
    type: 'HOT_THIS_WEEK',
    label: 'Hot This Week',
    icon: '🔥',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    description: 'Trending with rapid subscriber growth'
  },
  CONSISTENT_TRADER: {
    type: 'CONSISTENT_TRADER',
    label: 'Consistent',
    icon: '💎',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    description: 'Proven consistent performance'
  },
  HALL_OF_FAME: {
    type: 'HALL_OF_FAME',
    label: 'Hall of Fame',
    icon: '👑',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
    description: 'Legendary all-time performer'
  },
  NEW_PROVIDER: {
    type: 'NEW_PROVIDER',
    label: 'New Provider',
    icon: '⭐',
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-100',
    description: 'Recently joined platform'
  },
  RISING_STAR: {
    type: 'RISING_STAR',
    label: 'Rising Star',
    icon: '🚀',
    color: 'text-pink-700',
    bgColor: 'bg-pink-100',
    description: 'Fast growing provider'
  }
};

interface ProviderBadgeProps {
  type: BadgeType;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function ProviderBadge({ type, size = 'md', showLabel = true }: ProviderBadgeProps) {
  const badge = BADGE_DEFINITIONS[type];
  
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base'
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${badge.bgColor} ${badge.color} ${sizeClasses[size]}`}
      title={badge.description}
    >
      <span>{badge.icon}</span>
      {showLabel && <span>{badge.label}</span>}
    </span>
  );
}

interface BadgeListProps {
  badges: BadgeType[];
  maxDisplay?: number;
  size?: 'sm' | 'md' | 'lg';
}

export function BadgeList({ badges, maxDisplay = 3, size = 'sm' }: BadgeListProps) {
  const displayBadges = badges.slice(0, maxDisplay);
  const remaining = badges.length - maxDisplay;

  return (
    <div className="flex flex-wrap gap-1.5">
      {displayBadges.map((badgeType) => (
        <ProviderBadge key={badgeType} type={badgeType} size={size} />
      ))}
      {remaining > 0 && (
        <span className="px-2 py-1 text-xs font-semibold text-gray-600 bg-gray-100 rounded-full">
          +{remaining}
        </span>
      )}
    </div>
  );
}

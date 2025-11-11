'use client';

import React from 'react';
import { PositionCard } from './PositionCard';
import type { Position } from '@/types/position';

interface PositionListProps {
  positions: Position[];
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  onClose?: (position: Position) => void;
  onUpdate?: (position: Position) => void;
  onViewDetails?: (position: Position) => void;
  showActions?: boolean;
}

export function PositionList({
  positions,
  loading = false,
  error = null,
  emptyMessage = 'No positions found',
  onClose,
  onUpdate,
  onViewDetails,
  showActions = true,
}: PositionListProps) {
  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-red-900 mb-2">Error Loading Positions</h3>
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  // Empty state
  if (positions.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
        <div className="text-6xl mb-4">📊</div>
        <p className="text-gray-600 text-lg mb-2">{emptyMessage}</p>
        <p className="text-gray-500 text-sm">
          Positions will appear here when you execute trades
        </p>
      </div>
    );
  }

  // Positions list
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
      {positions.map((position) => (
        <PositionCard
          key={position.id}
          position={position}
          onClose={onClose}
          onUpdate={onUpdate}
          onViewDetails={onViewDetails}
          showActions={showActions}
        />
      ))}
    </div>
  );
}

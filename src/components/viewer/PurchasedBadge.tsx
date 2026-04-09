'use client';

interface PurchasedBadgeProps {
  purchaserName: string;  // Display name or username of who marked it purchased
  isCurrentUser: boolean; // true if the current viewer is the purchaser
}

export function PurchasedBadge({ purchaserName, isCurrentUser }: PurchasedBadgeProps) {
  return (
    <span className="text-sm text-[#6B7280] italic">
      {isCurrentUser ? 'Markerad som köpt av dig' : `Köpt av ${purchaserName}`}
    </span>
  );
}

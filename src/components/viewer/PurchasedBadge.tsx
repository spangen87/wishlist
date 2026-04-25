'use client';

interface PurchasedBadgeProps {
  purchaserName: string;
  isCurrentUser: boolean;
}

export function PurchasedBadge({ purchaserName, isCurrentUser }: PurchasedBadgeProps) {
  return (
    <span
      className="text-[12px] italic"
      style={{ color: 'var(--color-muted-light)' }}
    >
      {isCurrentUser ? 'Markerad av dig' : `Köpt av ${purchaserName}`}
    </span>
  );
}

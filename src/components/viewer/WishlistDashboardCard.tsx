'use client';
import Link from 'next/link';
import type { WishlistDoc } from '@/types/firestore';

interface WishlistDashboardCardProps {
  wishlist: WishlistDoc;
  childName: string;       // display name resolved from users/{childUid}
  itemCount: number;
  purchasedCount: number;
}

export function WishlistDashboardCard({
  wishlist,
  childName,
  itemCount,
  purchasedCount,
}: WishlistDashboardCardProps) {
  return (
    <Link
      href={`/viewer/${wishlist.id}`}
      className="block bg-[#FFF0E8] border border-[#E5D5CC] rounded-2xl shadow-sm hover:shadow-md transition-shadow p-4"
    >
      {/* Child name */}
      <h2 className="text-xl font-semibold text-[#171717] leading-tight">
        {childName}
      </h2>

      {/* Counts */}
      <p className="mt-2 text-sm text-[#6B7280]">
        {itemCount} {itemCount === 1 ? 'önskemål' : 'önskemål'} &middot;{' '}
        {purchasedCount} av {itemCount} köpta
      </p>

      {/* Placeholder thumbnail strip */}
      <div className="mt-3 w-12 h-12 rounded-md bg-[#E5D5CC]" aria-hidden="true" />
    </Link>
  );
}

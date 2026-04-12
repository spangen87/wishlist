'use client';
import Link from 'next/link';
import type { WishlistDoc } from '@/types/firestore';

interface ParentWishlistDashboardCardProps {
  wishlist: WishlistDoc;
  childName: string;
  itemCount: number;
  purchasedCount: number;
}

export function ParentWishlistDashboardCard({
  wishlist,
  childName,
  itemCount,
  purchasedCount,
}: ParentWishlistDashboardCardProps) {
  return (
    <div className="bg-white border border-[#E5D5CC] rounded-2xl p-4 flex flex-col gap-2 shadow-sm hover:shadow-md transition-shadow">
      {/* Parent badge */}
      <span className="text-xs font-semibold text-[#F97316] uppercase tracking-wide">
        Mitt barn
      </span>

      {/* Card body — navigates to viewer page */}
      <Link
        href={`/viewer/${wishlist.id}`}
        className="block"
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

        {/* Thumbnail placeholder */}
        <div className="mt-3 w-12 h-12 rounded-md bg-[#E5D5CC]" aria-hidden="true" />
      </Link>

      {/* Settings link */}
      <Link
        href={`/wishlist/${wishlist.id}/settings`}
        className="text-sm text-[#6B7280] hover:underline self-start"
      >
        Inställningar →
      </Link>
    </div>
  );
}

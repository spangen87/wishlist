'use client';
import Link from 'next/link';
import type { WishlistDoc } from '@/types/firestore';

interface ParentWishlistDashboardCardProps {
  wishlist: WishlistDoc;
  childName: string;
  itemCount: number;
  purchasedCount: number;
}

const INITIAL_BG = ['#6E5BE8', '#FF7AB8', '#7DE3FF', '#85F2CA', '#FFD36E'];

function pickColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return INITIAL_BG[h % INITIAL_BG.length];
}

export function ParentWishlistDashboardCard({
  wishlist,
  childName,
  itemCount,
  purchasedCount,
}: ParentWishlistDashboardCardProps) {
  const occasion = wishlist.occasion;
  const initial = (childName || '?').slice(0, 1).toUpperCase();
  const accent = pickColor(wishlist.id || childName);
  const progress = itemCount > 0 ? Math.round((purchasedCount / itemCount) * 100) : 0;

  return (
    <div
      className="light-card p-4 flex flex-col gap-3"
      style={{ background: '#fff' }}
    >
      <Link href={`/viewer/${wishlist.id}`} className="flex items-center gap-3 min-w-0">
        <div
          className="flex items-center justify-center font-display font-bold shrink-0"
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: `${accent}1f`,
            color: accent,
            fontSize: 20,
          }}
          aria-hidden="true"
        >
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display font-semibold text-[16px] truncate" style={{ color: 'var(--color-ink-light)' }}>
            {childName}
          </h2>
          {occasion && (
            <p className="text-[12px] font-tabular truncate" style={{ color: accent }}>
              {occasion.name} ·{' '}
              {new Date(occasion.date + 'T00:00:00').toLocaleDateString('sv-SE', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </p>
          )}
          <p className="text-[12px] font-tabular mt-0.5" style={{ color: 'var(--color-muted-light)' }}>
            {itemCount} {itemCount === 1 ? 'önskemål' : 'önskemål'} · {purchasedCount} köpta
          </p>
          <div
            className="mt-2 h-1 rounded-full overflow-hidden"
            style={{ background: 'var(--color-border-light)' }}
            aria-hidden="true"
          >
            <div
              className="h-full"
              style={{ width: `${progress}%`, background: accent, transition: 'width 200ms ease' }}
            />
          </div>
        </div>
      </Link>

      <Link
        href={`/wishlist/${wishlist.id}/settings`}
        className="text-[12px] font-bold self-start"
        style={{ color: accent }}
      >
        Inställningar →
      </Link>
    </div>
  );
}

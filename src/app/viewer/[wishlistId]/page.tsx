'use client';
import { use, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/client';
import { useAuth } from '@/components/AuthProvider';
import { subscribeToItems } from '@/lib/firebase/wishlist';
import { subscribeToPurchaseStatus } from '@/lib/firebase/viewer';
import { ViewerWishItemCard } from '@/components/viewer/ViewerWishItemCard';
import { LoadingSkeleton } from '@/components/wishlist/LoadingSkeleton';
import type { WishItemDoc, PurchaseStatusDoc } from '@/types/firestore';
import Link from 'next/link';

export default function ViewerWishlistPage({
  params,
}: {
  params: Promise<{ wishlistId: string }>;
}) {
  const { wishlistId } = use(params);
  const router = useRouter();
  const { user, role, loading } = useAuth();

  const [items, setItems] = useState<WishItemDoc[]>([]);
  const [statuses, setStatuses] = useState<Record<string, PurchaseStatusDoc>>({});
  const [displayNames, setDisplayNames] = useState<Map<string, string>>(new Map());
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && role === 'child') router.push('/wishlist');
  }, [loading, user, role, router]);

  // Fetch display name for a UID — cached in displayNames map
  const fetchDisplayName = useCallback(async (uid: string) => {
    if (displayNames.has(uid)) return;
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        const data = snap.data();
        const name: string = data.username ?? data.email ?? uid;
        setDisplayNames((prev) => new Map(prev).set(uid, name));
      }
    } catch {
      // Silently fail — fallback to UID
    }
  }, [displayNames]);

  // Subscribe to items and purchaseStatus in parallel
  useEffect(() => {
    if (loading || !user) return;

    const unsubItems = subscribeToItems(wishlistId, (newItems) => {
      setItems(newItems);
      setDataLoading(false);
    });

    const unsubStatus = subscribeToPurchaseStatus(wishlistId, (newStatuses) => {
      setStatuses(newStatuses);
      // Fetch display names for any new purchasedBy UIDs
      Object.values(newStatuses).forEach((s) => {
        if (s.purchasedBy) fetchDisplayName(s.purchasedBy);
      });
    });

    return () => {
      unsubItems();
      unsubStatus();
    };
  }, [loading, user, wishlistId, fetchDisplayName]);

  async function handleTogglePurchased(
    itemId: string,
    itemTitle: string,
    purchased: boolean
  ) {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) throw new Error('Not authenticated');

    const res = await fetch('/api/viewer/mark-purchased', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, wishlistId, itemId, itemTitle, purchased }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? 'API error');
    }
  }

  async function handleUpdateNote(itemId: string, itemTitle: string, note: string) {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) throw new Error('Not authenticated');
    const res = await fetch('/api/viewer/update-note', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, wishlistId, itemId, itemTitle, note }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? 'API error');
    }
  }

  if (loading || dataLoading) return <LoadingSkeleton />;
  if (!user) return null;

  if (error) {
    return (
      <main className="min-h-screen bg-[#FFF9F5] flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-[#DC2626] text-base">{error}</p>
        <button onClick={() => setError(null)} className="text-[#F97316] hover:underline text-sm min-h-[44px]">
          Försök igen
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FFF9F5] px-4 py-8 sm:px-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-[#171717]">Önskelista</h1>
          <Link
            href={`/viewer/${wishlistId}/activity`}
            className="text-sm text-[#6B7280] hover:underline min-h-[44px] flex items-center"
          >
            Visa aktivitetslogg
          </Link>
        </div>

        {/* Items */}
        {items.length === 0 ? (
          <p className="text-base text-[#6B7280] text-center py-16">
            Inga önskemål ännu.
          </p>
        ) : (
          <ul role="list" className="flex flex-col gap-6">
            {items.map((item) => (
              <ViewerWishItemCard
                key={item.id}
                item={item}
                wishlistId={wishlistId}
                status={statuses[item.id]}
                currentUid={user.uid}
                onTogglePurchased={handleTogglePurchased}
                onUpdateNote={handleUpdateNote}
                purchaserName={
                  statuses[item.id]?.purchasedBy
                    ? displayNames.get(statuses[item.id].purchasedBy!) ?? '...'
                    : undefined
                }
                otherViewerNotes={
                  (() => {
                    const statusDoc = statuses[item.id];
                    if (!statusDoc?.viewerNotes) return [];
                    return Object.entries(statusDoc.viewerNotes)
                      .filter(([uid]) => uid !== user.uid)
                      .map(([uid, note]) => ({
                        uid,
                        displayName: displayNames.get(uid) ?? uid,
                        note,
                      }));
                  })()
                }
              />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

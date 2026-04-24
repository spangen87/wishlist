'use client';
import { use, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/client';
import { useAuth } from '@/components/AuthProvider';
import { subscribeToItems } from '@/lib/firebase/wishlist';
import { subscribeToPurchaseStatus } from '@/lib/firebase/viewer';
import { ViewerWishItemCard } from '@/components/viewer/ViewerWishItemCard';
import { ParentAddItemForm } from '@/components/viewer/ParentAddItemForm';
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

  // Parent-specific state
  const [wishlistTitle, setWishlistTitle] = useState<string>('');
  const [isParent, setIsParent] = useState(false);
  const [occasion, setOccasion] = useState<{ name: string; date: string } | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [addItemError, setAddItemError] = useState<string | null>(null);

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

  // Subscribe to items and purchaseStatus in parallel; read wishlist doc for parent check
  useEffect(() => {
    if (loading || !user) return;

    // Read wishlist doc to get title and check parent access
    getDoc(doc(db, 'wishlists', wishlistId)).then((wishlistDoc) => {
      if (wishlistDoc.exists()) {
        const wlData = wishlistDoc.data();
        setWishlistTitle(wlData.title ?? '');
        setRenameValue(wlData.title ?? '');
        const parentUids: string[] = wlData.parentUids ?? [];
        setIsParent(parentUids.includes(user.uid));
        setOccasion(wlData.occasion ?? null);
      }
    }).catch(() => {
      // Silent — title and parent controls simply won't show
    });

    const unsubItems = subscribeToItems(wishlistId, (newItems) => {
      setItems(newItems);
      setDataLoading(false);
    });

    const unsubStatus = subscribeToPurchaseStatus(wishlistId, (newStatuses) => {
      setStatuses(newStatuses);
      // Fetch display names for any new purchasedBy UIDs
      Object.values(newStatuses).forEach((s) => {
        if (s.purchasedBy) fetchDisplayName(s.purchasedBy);
        if (s.reservedBy) fetchDisplayName(s.reservedBy);
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

  async function handleToggleReserved(
    itemId: string,
    itemTitle: string,
    reserve: boolean
  ) {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) throw new Error('Not authenticated');

    const res = await fetch('/api/viewer/reserve-item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, wishlistId, itemId, itemTitle, reserve }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      // Append ' 409' to message so ViewerWishItemCard can detect conflict errors
      throw new Error((body.error ?? 'API error') + (res.status === 409 ? ' 409' : ''));
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

  async function handleRename() {
    setIsRenaming(false);
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === wishlistTitle) return;
    setRenameError(null);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) return;
      const res = await fetch('/api/wishlist/update-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, wishlistId, title: trimmed }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setRenameError(body.error ?? 'Kunde inte spara nytt namn.');
        setRenameValue(wishlistTitle);
      } else {
        setWishlistTitle(trimmed);
      }
    } catch {
      setRenameError('Något gick fel. Försök igen.');
      setRenameValue(wishlistTitle);
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
          <Link
            href="/dashboard"
            className="text-sm text-[#6B7280] hover:underline min-h-[44px] flex items-center"
          >
            ← Mina önskelistor
          </Link>
          <Link
            href={`/viewer/${wishlistId}/activity`}
            className="text-sm text-[#6B7280] hover:underline min-h-[44px] flex items-center"
          >
            Visa aktivitetslogg
          </Link>
        </div>

        {/* Occasion banner — visible to all viewers/parents */}
        {occasion && (() => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const target = new Date(occasion.date + 'T00:00:00');
          const days = Math.round((target.getTime() - today.getTime()) / 86_400_000);
          const formattedDate = target.toLocaleDateString('sv-SE', {
            year: 'numeric', month: 'long', day: 'numeric',
          });
          return (
            <div className="mb-5 bg-[#FFF0E8] border border-[#E5D5CC] rounded-2xl px-4 py-3 flex flex-col gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-[#F97316]">{occasion.name}</span>
                <span className="text-sm text-[#6B7280]">{formattedDate}</span>
              </div>
              {days >= 0 && days <= 30 && (
                <span className="text-sm font-semibold text-[#F97316]">
                  {days === 0 ? 'Idag!' : `Om ${days} ${days === 1 ? 'dag' : 'dagar'}!`}
                </span>
              )}
            </div>
          );
        })()}

        {/* Parent-only controls (D-14) — invisible to viewers (D-15) */}
        {isParent && (
          <div className="mb-6 flex flex-col gap-4">
            {/* Inline rename (D-24) */}
            <div className="flex items-center gap-2">
              {isRenaming ? (
                <input
                  type="text"
                  value={renameValue}
                  autoFocus
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={handleRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename();
                    if (e.key === 'Escape') {
                      setIsRenaming(false);
                      setRenameValue(wishlistTitle);
                    }
                  }}
                  className="flex-1 border border-[#E5D5CC] rounded-md px-3 py-2 text-xl font-semibold text-[#171717] bg-white"
                  aria-label="Redigera önskelistans namn"
                />
              ) : (
                <button
                  onClick={() => setIsRenaming(true)}
                  className="text-xl font-semibold text-[#171717] hover:text-[#F97316] transition-colors text-left"
                  title="Klicka för att byta namn"
                >
                  {wishlistTitle || 'Namnlös önskelista'}
                  <span className="ml-2 text-sm font-normal text-[#6B7280]">✎</span>
                </button>
              )}
            </div>
            {renameError && (
              <p role="alert" className="text-[#DC2626] text-sm">
                {renameError}
              </p>
            )}

            {/* Settings link and add item toggle */}
            <div className="flex items-center gap-4 flex-wrap">
              <button
                onClick={() => setShowAddItem((v) => !v)}
                className="bg-[#F97316] hover:bg-[#EA6C0A] text-white rounded-xl px-4 py-2 font-semibold text-sm min-h-[44px] transition-colors"
              >
                {showAddItem ? 'Avbryt' : 'Lägg till önskemål'}
              </button>
              <Link
                href={`/wishlist/${wishlistId}/settings`}
                className="text-sm text-[#6B7280] hover:underline min-h-[44px] flex items-center"
              >
                Inställningar
              </Link>
            </div>

            {/* Inline add item form (D-14) */}
            {showAddItem && (
              <ParentAddItemForm
                wishlistId={wishlistId}
                onClose={() => setShowAddItem(false)}
                onError={(msg) => setAddItemError(msg)}
              />
            )}
            {addItemError && (
              <p role="alert" className="text-[#DC2626] text-sm">
                {addItemError}
              </p>
            )}
          </div>
        )}

        {/* Items */}
        {items.length === 0 ? (
          <p className="text-base text-[#6B7280] text-center py-16">
            Inga önskemål ännu.
          </p>
        ) : (() => {
          const favoriteItems = items.filter((i) => i.isFavorite);
          const otherItems = items.filter((i) => !i.isFavorite);

          function renderCard(item: WishItemDoc) {
            const statusDoc = statuses[item.id];
            return (
              <ViewerWishItemCard
                key={item.id}
                item={item}
                wishlistId={wishlistId}
                status={statusDoc}
                currentUid={user!.uid}
                onTogglePurchased={handleTogglePurchased}
                onUpdateNote={handleUpdateNote}
                onToggleReserved={handleToggleReserved}
                purchaserName={
                  statusDoc?.purchasedBy
                    ? displayNames.get(statusDoc.purchasedBy) ?? '...'
                    : undefined
                }
                reserverName={
                  statusDoc?.reservedBy
                    ? displayNames.get(statusDoc.reservedBy) ?? '...'
                    : undefined
                }
                otherViewerNotes={
                  statusDoc?.viewerNotes
                    ? Object.entries(statusDoc.viewerNotes)
                        .filter(([uid]) => uid !== user!.uid)
                        .map(([uid, note]) => ({
                          uid,
                          displayName: displayNames.get(uid) ?? uid,
                          note,
                        }))
                    : []
                }
              />
            );
          }

          return (
            <>
              {favoriteItems.length > 0 && (
                <section className="mb-8">
                  <h2 className="text-sm font-semibold text-[#F97316] uppercase tracking-wide mb-3">
                    ★ Favoriter
                  </h2>
                  <ul role="list" className="flex flex-col gap-6">
                    {favoriteItems.map(renderCard)}
                  </ul>
                </section>
              )}
              {otherItems.length > 0 && (
                <section>
                  {favoriteItems.length > 0 && (
                    <h2 className="text-sm font-semibold text-[#6B7280] uppercase tracking-wide mb-3">
                      Övriga önskemål
                    </h2>
                  )}
                  <ul role="list" className="flex flex-col gap-6">
                    {otherItems.map(renderCard)}
                  </ul>
                </section>
              )}
            </>
          );
        })()}
      </div>
    </main>
  );
}

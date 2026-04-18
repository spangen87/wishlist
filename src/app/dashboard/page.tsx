'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { doc, getDoc, collection, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { useAuth } from '@/components/AuthProvider';
import { subscribeToViewerWishlists, subscribeToParentWishlists } from '@/lib/firebase/viewer';
import { WishlistDashboardCard } from '@/components/viewer/WishlistDashboardCard';
import { ParentWishlistDashboardCard } from '@/components/viewer/ParentWishlistDashboardCard';
import type { WishlistDoc } from '@/types/firestore';

interface WishlistStats {
  itemCount: number;
  purchasedCount: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, role, loading } = useAuth();

  const [parentWishlists, setParentWishlists] = useState<WishlistDoc[]>([]);
  const [viewerWishlists, setViewerWishlists] = useState<WishlistDoc[]>([]);
  const [childNames, setChildNames] = useState<Map<string, string>>(new Map());
  const [stats, setStats] = useState<Map<string, WishlistStats>>(new Map());
  const [parentDataLoading, setParentDataLoading] = useState(true);
  const [viewerDataLoading, setViewerDataLoading] = useState(true);
  const fetchedNamesRef = useRef(new Set<string>());

  // Auth + role redirects
  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && role === 'child') router.push('/wishlist');
  }, [loading, user, role, router]);

  // Fetch child display name — stable ref prevents unnecessary re-subscriptions
  const fetchChildName = useCallback(async (uid: string) => {
    if (fetchedNamesRef.current.has(uid)) return;
    fetchedNamesRef.current.add(uid);
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        const data = snap.data();
        const name: string = data.displayName ?? data.username ?? data.email ?? uid;
        setChildNames((prev) => new Map(prev).set(uid, name));
      }
    } catch { /* silent */ }
  }, []);

  // Subscribe to wishlist stats (item count + purchased count) for a single wishlist
  const subscribeToStats = useCallback((wishlistId: string) => {
    const itemUnsub = onSnapshot(
      collection(db, 'wishlists', wishlistId, 'items'),
      (snap) => {
        setStats((prev) => {
          const existing = prev.get(wishlistId) ?? { itemCount: 0, purchasedCount: 0 };
          return new Map(prev).set(wishlistId, { ...existing, itemCount: snap.size });
        });
      }
    );
    const statusUnsub = onSnapshot(
      collection(db, 'wishlists', wishlistId, 'purchaseStatus'),
      (snap) => {
        const purchased = snap.docs.filter((d) => !!d.data().purchasedBy).length;
        setStats((prev) => {
          const existing = prev.get(wishlistId) ?? { itemCount: 0, purchasedCount: 0 };
          return new Map(prev).set(wishlistId, { ...existing, purchasedCount: purchased });
        });
      }
    );
    return () => { itemUnsub(); statusUnsub(); };
  }, []);

  // Subscribe to both parent and viewer wishlists
  useEffect(() => {
    if (loading || !user) return;

    const unsubParent = subscribeToParentWishlists(
      user.uid,
      (newLists, fromCache) => {
        setParentWishlists(newLists);
        if (!fromCache || newLists.length > 0) {
          setParentDataLoading(false);
        }
        newLists.forEach((wl) => {
          fetchChildName(wl.childUid);
          subscribeToStats(wl.id);
        });
      },
      () => setParentDataLoading(false)
    );

    const unsubViewer = subscribeToViewerWishlists(
      user.uid,
      (newLists, fromCache) => {
        setViewerWishlists(newLists);
        if (!fromCache || newLists.length > 0) {
          setViewerDataLoading(false);
        }
        newLists.forEach((wl) => {
          fetchChildName(wl.childUid);
          subscribeToStats(wl.id);
        });
      },
      () => setViewerDataLoading(false)
    );

    return () => {
      unsubParent();
      unsubViewer();
    };
  // fetchChildName and subscribeToStats are stable via useCallback — intentionally omitted
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  async function handleLogout() {
    await signOut(auth);
    router.push('/login');
  }

  async function handleDeleteSelf() {
    if (
      !window.confirm(
        'Är du säker på att du vill ta bort ditt konto? All din data raderas permanent och kan inte återställas.'
      )
    )
      return;
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/auth/user/${user!.uid}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok) throw new Error();
      await signOut(auth);
      router.push('/login');
    } catch {
      // Silent fail — could add toast in future phase
    }
  }

  const dataLoading = parentDataLoading || viewerDataLoading;

  if (loading || dataLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FFF9F5]">
        <p className="text-[#6B7280]">Laddar…</p>
      </main>
    );
  }

  if (!user) return null;

  return (
    <main className="min-h-screen bg-[#FFF9F5] px-4 py-8 sm:px-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-[#171717]">Mina önskelistor</h1>
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={handleLogout}
              className="text-sm text-[#6B7280] hover:underline min-h-[44px]"
            >
              Logga ut
            </button>
            {role !== 'child' && (
              <button
                onClick={handleDeleteSelf}
                className="text-sm text-[#DC2626] hover:underline"
              >
                Ta bort mitt konto
              </button>
            )}
          </div>
        </div>

        {/* Section 1: Mina barn */}
        <section>
          <h2 className="text-lg font-semibold text-[#171717] mb-4">Mina barn</h2>
          {parentWishlists.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-[#E5D5CC] rounded-2xl">
              <p className="text-[#6B7280] text-sm">Du har inga barn tillagda ännu.</p>
              <button
                onClick={() => router.push('/add-child')}
                className="mt-3 text-[#F97316] font-semibold text-sm hover:underline min-h-[44px]"
              >
                Lägg till ett barn →
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {parentWishlists.map((wl) => (
                <ParentWishlistDashboardCard
                  key={wl.id}
                  wishlist={wl}
                  childName={childNames.get(wl.childUid) ?? '…'}
                  itemCount={stats.get(wl.id)?.itemCount ?? 0}
                  purchasedCount={stats.get(wl.id)?.purchasedCount ?? 0}
                />
              ))}
            </div>
          )}
          {parentWishlists.length > 0 && (
            <button
              onClick={() => router.push('/add-child')}
              className="mt-4 border border-[#E5D5CC] rounded-xl px-4 py-2 text-sm font-bold text-[#171717] hover:bg-[#FFF0E8] min-h-[44px] transition-colors"
            >
              Lägg till barn
            </button>
          )}
        </section>

        {/* Divider */}
        <div className="my-8 border-t border-[#E5D5CC]" />

        {/* Section 2: Jag är inbjuden till */}
        <section>
          <h2 className="text-lg font-semibold text-[#171717] mb-4">Jag är inbjuden till</h2>
          {viewerWishlists.length === 0 ? (
            <p className="text-[#6B7280] text-sm">Du är inte inbjuden till några önskelistor.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {viewerWishlists.map((wl) => (
                <WishlistDashboardCard
                  key={wl.id}
                  wishlist={wl}
                  childName={childNames.get(wl.childUid) ?? '…'}
                  itemCount={stats.get(wl.id)?.itemCount ?? 0}
                  purchasedCount={stats.get(wl.id)?.purchasedCount ?? 0}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

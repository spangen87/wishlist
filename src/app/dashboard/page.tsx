'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { doc, getDoc, collection, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { useAuth } from '@/components/AuthProvider';
import { subscribeToViewerWishlists } from '@/lib/firebase/viewer';
import { WishlistDashboardCard } from '@/components/viewer/WishlistDashboardCard';
import type { WishlistDoc } from '@/types/firestore';

interface WishlistStats {
  itemCount: number;
  purchasedCount: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, role, loading } = useAuth();

  const [wishlists, setWishlists] = useState<WishlistDoc[]>([]);
  const [childNames, setChildNames] = useState<Map<string, string>>(new Map());
  const [stats, setStats] = useState<Map<string, WishlistStats>>(new Map());
  const [dataLoading, setDataLoading] = useState(true);

  // Auth + role redirects (D-21)
  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && role === 'child') router.push('/wishlist');
  }, [loading, user, role, router]);

  // Fetch child display name — cached
  const fetchChildName = useCallback(async (uid: string) => {
    if (childNames.has(uid)) return;
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        const data = snap.data();
        const name: string = data.username ?? data.email ?? uid;
        setChildNames((prev) => new Map(prev).set(uid, name));
      }
    } catch { /* silent */ }
  }, [childNames]);

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

  // Subscribe to viewer's wishlists
  useEffect(() => {
    if (loading || !user || role !== 'viewer') return;

    const unsubLists = subscribeToViewerWishlists(user.uid, (newLists) => {
      setWishlists(newLists);
      setDataLoading(false);
      newLists.forEach((wl) => {
        fetchChildName(wl.childUid);
        subscribeToStats(wl.id);
      });
    });

    return () => unsubLists();
  // subscribeToStats is intentionally not in deps — stable ref via useCallback
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, role, fetchChildName]);

  async function handleLogout() {
    await signOut(auth);
    router.push('/login');
  }

  if (loading || (role === 'viewer' && dataLoading)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FFF9F5]">
        <p className="text-[#6B7280]">Laddar…</p>
      </main>
    );
  }

  if (!user) return null;

  // viewer role — show grid
  if (role === 'viewer') {
    return (
      <main className="min-h-screen bg-[#FFF9F5] px-4 py-8 sm:px-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-semibold text-[#171717]">Mina önskelistor</h1>
            <button
              onClick={handleLogout}
              className="text-sm text-[#6B7280] hover:underline min-h-[44px]"
            >
              Logga ut
            </button>
          </div>

          {wishlists.length === 0 ? (
            <div className="text-center py-16">
              <h2 className="text-[28px] font-semibold text-[#171717] leading-[1.2]">
                Inga önskelistor än
              </h2>
              <p className="mt-4 text-base text-[#6B7280] max-w-sm mx-auto">
                Du är inte tillagd på någon önskelista ännu. Be ett barn att dela sin länk med dig.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {wishlists.map((wl) => (
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
        </div>
      </main>
    );
  }

  // Fallback — non-viewer, non-child (e.g. parent role or undefined): show stub
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4 bg-[#FFF9F5]">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[#171717]">Dashboard</h1>
        <p className="mt-2 text-[#6B7280]">
          Inloggad som <span className="font-medium">{user.email}</span>
        </p>
      </div>
      <button
        onClick={handleLogout}
        className="bg-[#DC2626] text-white rounded px-6 py-2 font-medium hover:bg-red-700 min-h-[44px]"
      >
        Logga ut
      </button>
    </main>
  );
}

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
import { LightShell, Molly, Plus, LogOut } from '@/components/galaxy';
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
  const statsUnsubsRef = useRef(new Map<string, () => void>());

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && role === 'child') router.push('/wishlist');
  }, [loading, user, role, router]);

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

  useEffect(() => {
    if (loading || !user) return;

    function subscribeToStatsTracked(wishlistId: string) {
      if (statsUnsubsRef.current.has(wishlistId)) return;
      const unsub = subscribeToStats(wishlistId);
      statsUnsubsRef.current.set(wishlistId, unsub);
    }

    const unsubParent = subscribeToParentWishlists(
      user.uid,
      (newLists) => {
        setParentWishlists(newLists);
        setParentDataLoading(false);
        newLists.forEach((wl) => {
          fetchChildName(wl.childUid);
          subscribeToStatsTracked(wl.id);
        });
      },
      () => setParentDataLoading(false)
    );

    const unsubViewer = subscribeToViewerWishlists(
      user.uid,
      (newLists) => {
        setViewerWishlists(newLists);
        setViewerDataLoading(false);
        newLists.forEach((wl) => {
          fetchChildName(wl.childUid);
          subscribeToStatsTracked(wl.id);
        });
      },
      () => setViewerDataLoading(false)
    );

    return () => {
      unsubParent();
      unsubViewer();
      statsUnsubsRef.current.forEach((unsub) => unsub());
      statsUnsubsRef.current.clear();
    };
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
    let idToken: string | undefined;
    try {
      idToken = await auth.currentUser?.getIdToken(true);
    } catch {
      alert('Sessionen har gått ut. Logga ut och logga in igen.');
      return;
    }
    try {
      const res = await fetch(`/api/auth/user/${user!.uid}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok) throw new Error();
      await signOut(auth);
      router.push('/login');
    } catch {
      alert('Det gick inte att ta bort kontot. Försök igen.');
    }
  }

  const dataLoading = parentDataLoading || viewerDataLoading;

  if (loading || dataLoading) {
    return (
      <LightShell>
        <div className="flex min-h-[100dvh] items-center justify-center">
          <p style={{ color: 'var(--color-muted-light)' }}>Laddar…</p>
        </div>
      </LightShell>
    );
  }

  if (!user) return null;

  const userInitial = (user.email ?? '?').slice(0, 1).toUpperCase();

  return (
    <LightShell>
      {/* Header */}
      <header
        className="app-page app-top pb-5 flex items-start justify-between gap-3"
        style={{ borderBottom: '1px solid var(--color-border-light)', background: '#fff' }}
      >
        <div className="min-w-0">
          <p className="text-[11px] font-bold tracking-caps" style={{ color: 'var(--color-muted-light)' }}>
            Önskestjärnan
          </p>
          <h1 className="font-display font-bold text-[24px] mt-1" style={{ color: 'var(--color-ink-light)' }}>
            Mina önskelistor
          </h1>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Molly size={36} mood="happy" eyeColor="#1C1B2E" blushColor="#FF7AB8" />
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Logga ut"
            className="flex items-center justify-center min-h-[40px] min-w-[40px] rounded-full"
            style={{ color: 'var(--color-muted-light)', background: 'var(--color-bg-light)' }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <div className="app-page app-bottom pt-5 mx-auto w-full max-w-2xl">
        {/* Section: Mina barn */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-[11px] font-bold tracking-caps" style={{ color: 'var(--color-muted-light)' }}>
              Mina barn
            </h2>
            {parentWishlists.length > 0 && (
              <button
                type="button"
                onClick={() => router.push('/add-child')}
                className="text-[12px] font-bold flex items-center gap-1"
                style={{ color: 'var(--color-accent)' }}
              >
                <Plus size={12} /> Lägg till
              </button>
            )}
          </div>

          {parentWishlists.length === 0 ? (
            <button
              type="button"
              onClick={() => router.push('/add-child')}
              className="w-full text-center px-4 py-5 rounded-xl text-[14px] font-bold"
              style={{
                color: 'var(--color-accent)',
                border: '1.5px dashed var(--color-border-light)',
                background: '#fff',
              }}
            >
              + Lägg till ditt första barn
            </button>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {parentWishlists.map((wl) => (
                <ParentWishlistDashboardCard
                  key={wl.id}
                  wishlist={wl}
                  childName={childNames.get(wl.childUid) ?? '…'}
                  itemCount={stats.get(wl.id)?.itemCount ?? 0}
                  purchasedCount={stats.get(wl.id)?.purchasedCount ?? 0}
                />
              ))}
              <button
                type="button"
                onClick={() => router.push('/add-child')}
                className="text-center px-4 py-5 rounded-xl text-[13px] font-bold flex items-center justify-center"
                style={{
                  color: 'var(--color-accent)',
                  border: '1.5px dashed var(--color-border-light)',
                  background: '#fff',
                  minHeight: 90,
                }}
              >
                + Lägg till barn
              </button>
            </div>
          )}
        </section>

        {/* Section: Inbjuden till */}
        <section>
          <h2
            className="text-[11px] font-bold tracking-caps mb-3 px-1"
            style={{ color: 'var(--color-muted-light)' }}
          >
            Inbjuden till
          </h2>
          {viewerWishlists.length === 0 ? (
            <p
              className="text-[13px] px-1"
              style={{ color: 'var(--color-muted-light)' }}
            >
              Du är inte inbjuden till några önskelistor.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

        {role !== 'child' && (
          <div className="mt-10 text-center">
            <button
              type="button"
              onClick={handleDeleteSelf}
              className="text-[12px]"
              style={{ color: 'var(--color-destructive)' }}
            >
              Ta bort mitt konto
            </button>
            <p className="mt-1 text-[10px]" style={{ color: 'var(--color-muted-light)' }}>
              {userInitial} · {user.email}
            </p>
          </div>
        )}
      </div>
    </LightShell>
  );
}

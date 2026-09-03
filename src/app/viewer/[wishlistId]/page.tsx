'use client';
import { use, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/client';
import { useAuth } from '@/components/AuthProvider';
import { subscribeToItems } from '@/lib/firebase/wishlist';
import { subscribeToPurchaseStatus, subscribeToParentWishlists } from '@/lib/firebase/viewer';
import { ViewerWishItemCard } from '@/components/viewer/ViewerWishItemCard';
import { ParentAddItemForm } from '@/components/viewer/ParentAddItemForm';
import { deleteWishItem } from '@/lib/firebase/wishlist';
import { isAccountFreeList, wishlistDisplayName } from '@/lib/wishlist-kind';
import { LoadingSkeleton } from '@/components/wishlist/LoadingSkeleton';
import type { WishItemDoc, PurchaseStatusDoc, WishlistDoc } from '@/types/firestore';
import Link from 'next/link';
import { LightShell, ArrowLeft, Cog, Plus, Pencil, Heart, Calendar, Molly } from '@/components/galaxy';

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
  // Someone opening a list URL they were never invited to: the rules deny both
  // the wishlist doc and its items, so the page has to say so instead of
  // waiting on data that will never arrive.
  const [accessDenied, setAccessDenied] = useState(false);

  const [wishlistTitle, setWishlistTitle] = useState<string>('');
  const [childUid, setChildUid] = useState<string>('');
  const [isParent, setIsParent] = useState(false);
  // Surprise mode: an account-free list can hide its purchases from its own
  // parents. Viewers always see them.
  const [canSeePurchases, setCanSeePurchases] = useState(true);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemActionError, setItemActionError] = useState<string | null>(null);
  const [siblingLists, setSiblingLists] = useState<WishlistDoc[]>([]);
  const [childNames, setChildNames] = useState<Map<string, string>>(new Map());
  const [occasion, setOccasion] = useState<{ name: string; date: string } | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [addItemError, setAddItemError] = useState<string | null>(null);
  const fetchedNamesRef = useRef(new Set<string>());
  const fetchedChildNamesRef = useRef(new Set<string>());

  // Reset per-list state when switching between children so the previous
  // child's items don't flash while the new subscriptions warm up.
  const [prevWishlistId, setPrevWishlistId] = useState(wishlistId);
  if (prevWishlistId !== wishlistId) {
    setPrevWishlistId(wishlistId);
    setItems([]);
    setStatuses({});
    setDataLoading(true);
    setShowAddItem(false);
    setIsRenaming(false);
    setRenameError(null);
    setAddItemError(null);
    setEditingItemId(null);
    setItemActionError(null);
    setCanSeePurchases(true);
    setAccessDenied(false);
  }

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && role === 'child') router.push('/wishlist');
  }, [loading, user, role, router]);

  // Ref-based dedupe keeps this callback stable — a state-based check would
  // recreate it on every name fetch and tear down the Firestore subscriptions.
  const fetchDisplayName = useCallback(async (uid: string) => {
    if (fetchedNamesRef.current.has(uid)) return;
    fetchedNamesRef.current.add(uid);
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        const data = snap.data();
        const name: string = data.username ?? data.email ?? uid;
        setDisplayNames((prev) => new Map(prev).set(uid, name));
      }
    } catch {
      // silent
    }
  }, []);

  const fetchChildName = useCallback(async (uid: string) => {
    if (fetchedChildNamesRef.current.has(uid)) return;
    fetchedChildNamesRef.current.add(uid);
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        const data = snap.data();
        const name: string = data.displayName ?? data.username ?? data.email ?? uid;
        setChildNames((prev) => new Map(prev).set(uid, name));
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    if (loading || !user) return;

    // The purchaseStatus subscription can only be opened once the wishlist doc
    // tells us whether we may read it, so it is set up inside the promise —
    // `cancelled` keeps a late resolve from leaking a listener after unmount.
    let cancelled = false;
    let unsubStatus: (() => void) | null = null;

    getDoc(doc(db, 'wishlists', wishlistId)).then((wishlistDoc) => {
      if (cancelled) return;
      if (!wishlistDoc.exists()) {
        setAccessDenied(true);
        setDataLoading(false);
        return;
      }
      const wlData = wishlistDoc.data();
      setWishlistTitle(wlData.title ?? '');
      setRenameValue(wlData.title ?? '');
      const parentUids: string[] = wlData.parentUids ?? [];
      const viewerUids: string[] = wlData.viewerUids ?? [];
      const callerIsParent = parentUids.includes(user.uid);
      setIsParent(callerIsParent);
      setOccasion(wlData.occasion ?? null);
      setChildUid(wlData.childUid ?? '');
      if (wlData.childUid) fetchChildName(wlData.childUid);

      if (
        !callerIsParent &&
        !viewerUids.includes(user.uid) &&
        wlData.childUid !== user.uid
      ) {
        setAccessDenied(true);
        setDataLoading(false);
        return;
      }

      const maySeePurchases =
        viewerUids.includes(user.uid) || (callerIsParent && wlData.hidePurchases !== true);
      setCanSeePurchases(maySeePurchases);

      // Subscribing to purchaseStatus we are not allowed to read would only
      // raise a rules error, so the surprise-mode branch simply never asks.
      if (!maySeePurchases) return;
      unsubStatus = subscribeToPurchaseStatus(wishlistId, (newStatuses) => {
        setStatuses(newStatuses);
        Object.values(newStatuses).forEach((s) => {
          if (s.purchasedBy) fetchDisplayName(s.purchasedBy);
          if (s.reservedBy) fetchDisplayName(s.reservedBy);
        });
      });
    }).catch(() => {
      // The only way this read fails is the rules refusing it — the caller is
      // not the child, a viewer or a parent on this list.
      if (cancelled) return;
      setAccessDenied(true);
      setDataLoading(false);
    });

    const unsubItems = subscribeToItems(
      wishlistId,
      (newItems) => {
        setItems(newItems);
        setDataLoading(false);
      },
      () => {
        if (cancelled) return;
        setAccessDenied(true);
        setDataLoading(false);
      }
    );

    return () => {
      cancelled = true;
      unsubItems();
      unsubStatus?.();
    };
  }, [loading, user, wishlistId, fetchDisplayName, fetchChildName]);

  // Quick switcher between the parent's children (shown when there is
  // more than one list the user has parent access to).
  useEffect(() => {
    if (loading || !user) return;
    const unsub = subscribeToParentWishlists(user.uid, (lists) => {
      setSiblingLists(lists);
      lists.forEach((wl) => { if (wl.childUid) fetchChildName(wl.childUid); });
    });
    return unsub;
  }, [loading, user, fetchChildName]);

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

  async function handleDeleteItem(itemId: string, itemTitle: string) {
    if (!window.confirm(`Ta bort "${itemTitle}" från listan?`)) return;
    setItemActionError(null);
    try {
      await deleteWishItem(wishlistId, itemId);
    } catch {
      setItemActionError('Kunde inte ta bort önskemålet. Försök igen.');
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

  if (accessDenied) {
    return (
      <LightShell>
        <header
          className="flex items-center gap-3 app-page app-top pb-4"
          style={{ borderBottom: '1px solid var(--color-border-light)', background: '#fff' }}
        >
          <Link
            href="/dashboard"
            aria-label="Tillbaka till mina listor"
            className="flex items-center justify-center min-h-[44px] min-w-[44px] -ml-2"
            style={{ color: 'var(--color-ink-light)' }}
          >
            <ArrowLeft size={18} />
          </Link>
          <h1 className="font-display font-bold text-[20px]">Önskelista</h1>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 app-page app-bottom text-center">
          <Molly size={72} mood="thinking" eyeColor="#1C1B2E" blushColor="#FF7AB8" />
          <h2 className="font-display font-bold text-[20px]" style={{ color: 'var(--color-ink-light)' }}>
            Du har inte tillgång till den här listan
          </h2>
          <p className="text-[14px] max-w-xs leading-relaxed" style={{ color: 'var(--color-muted-light)' }}>
            Listan kan ha tagits bort, eller så är du inte inbjuden till den. Be
            den som äger listan om en delningslänk — en list-adress räcker inte
            i sig för att komma in.
          </p>
          <Link href="/dashboard" className="light-cta-outline mt-1">
            Till mina listor
          </Link>
        </div>
      </LightShell>
    );
  }

  if (error) {
    return (
      <LightShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
          <p className="text-[14px]" style={{ color: 'var(--color-destructive)' }}>{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            className="light-cta-outline"
          >
            Försök igen
          </button>
        </div>
      </LightShell>
    );
  }

  const purchased = Object.values(statuses).filter((s) => !!s?.purchasedBy).length;
  const total = items.length;
  const progress = total > 0 ? Math.round((purchased / total) * 100) : 0;

  const favoriteItems = items.filter((i) => i.isFavorite);
  const otherItems = items.filter((i) => !i.isFavorite);

  const accountFree = isAccountFreeList({ childUid });
  const childName = childUid ? childNames.get(childUid) ?? '' : '';
  const fallbackTitle = childName ? `${childName}s önskelista` : 'Önskelista';
  // Nobody else can edit an account-free list's wishes — there is no child
  // login behind it — so its parents get the edit and delete controls.
  const canManageItems = isParent && accountFree;
  const showSwitcher = isParent && siblingLists.length > 1;
  const switcherName = (wl: WishlistDoc) =>
    wishlistDisplayName(wl, childNames.get(wl.childUid));
  const switcherLists = [...siblingLists].sort((a, b) =>
    switcherName(a).localeCompare(switcherName(b), 'sv')
  );

  function renderCard(item: WishItemDoc) {
    const statusDoc = statuses[item.id];
    if (editingItemId === item.id) {
      return (
        <li key={item.id}>
          <ParentAddItemForm
            wishlistId={wishlistId}
            item={item}
            onClose={() => setEditingItemId(null)}
            onError={(msg) => setItemActionError(msg)}
          />
        </li>
      );
    }
    return (
      <ViewerWishItemCard
        key={item.id}
        item={item}
        wishlistId={wishlistId}
        status={statusDoc}
        currentUid={user!.uid}
        hidePurchaseInfo={!canSeePurchases}
        onEdit={canManageItems ? () => setEditingItemId(item.id) : undefined}
        onDelete={canManageItems ? () => handleDeleteItem(item.id, item.title) : undefined}
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
    <LightShell>
      {/* Top bar */}
      <header
        className="flex items-center justify-between gap-3 app-page app-top pb-3"
        style={{ background: '#fff' }}
      >
        <Link
          href="/dashboard"
          aria-label="Mina listor"
          className="flex items-center gap-1.5 text-[13px] min-h-[40px]"
          style={{ color: 'var(--color-muted-light)' }}
        >
          <ArrowLeft size={16} /> Mina listor
        </Link>
        {canSeePurchases && (
          <Link
            href={`/viewer/${wishlistId}/activity`}
            className="text-[13px] font-semibold"
            style={{ color: 'var(--color-accent)' }}
          >
            Aktivitet →
          </Link>
        )}
      </header>

      {/* Child switcher — jump straight between siblings' lists */}
      {showSwitcher && (
        <nav
          aria-label="Byt önskelista"
          className="app-page pb-3 flex gap-2 overflow-x-auto"
          style={{ background: '#fff' }}
        >
          {switcherLists.map((wl) => {
            const active = wl.id === wishlistId;
            return (
              <Link
                key={wl.id}
                href={`/viewer/${wl.id}`}
                aria-current={active ? 'page' : undefined}
                className="shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-bold"
                style={
                  active
                    ? { background: 'var(--color-accent)', color: '#fff' }
                    : {
                        background: 'var(--color-bg-light)',
                        color: 'var(--color-muted-light)',
                        border: '1px solid var(--color-border-light)',
                      }
                }
              >
                {switcherName(wl)}
              </Link>
            );
          })}
        </nav>
      )}

      <div
        className="app-page pb-4"
        style={{ background: '#fff', borderBottom: '1px solid var(--color-border-light)' }}
      >
        {childName && !!wishlistTitle && (
          <p
            className="text-[11px] font-bold tracking-caps mb-1"
            style={{ color: 'var(--color-muted-light)' }}
          >
            {childName}
          </p>
        )}
        {isParent && isRenaming ? (
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
            className="light-input font-display text-[22px] font-bold"
            aria-label="Redigera önskelistans namn"
          />
        ) : (
          <button
            type="button"
            onClick={isParent ? () => setIsRenaming(true) : undefined}
            className="font-display font-bold text-[24px] flex items-center gap-2 text-left"
            style={{ color: 'var(--color-ink-light)', cursor: isParent ? 'pointer' : 'default' }}
            aria-label={isParent ? 'Klicka för att byta namn' : undefined}
          >
            {wishlistTitle || fallbackTitle}
            {isParent && <Pencil size={14} color="var(--color-muted-light)" />}
          </button>
        )}
        {renameError && (
          <p role="alert" className="mt-1 text-[12px]" style={{ color: 'var(--color-destructive)' }}>
            {renameError}
          </p>
        )}

        {canSeePurchases ? (
          <div className="flex items-center gap-3 mt-3">
            <span className="text-[12px] font-tabular" style={{ color: 'var(--color-muted-light)' }}>
              {purchased} av {total} köpta
            </span>
            <div
              className="flex-1 h-1 rounded-full overflow-hidden"
              style={{ background: 'var(--color-border-light)' }}
              aria-hidden="true"
            >
              <div
                className="h-full"
                style={{ width: `${progress}%`, background: 'var(--color-accent)', transition: 'width 220ms ease' }}
              />
            </div>
          </div>
        ) : (
          <p className="mt-3 text-[12px] font-tabular" style={{ color: 'var(--color-muted-light)' }}>
            {total} {total === 1 ? 'önskemål' : 'önskemål'} · köpen är dolda för dig
          </p>
        )}

        {occasion && (() => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const target = new Date(occasion.date + 'T00:00:00');
          const days = Math.round((target.getTime() - today.getTime()) / 86_400_000);
          const formattedDate = target.toLocaleDateString('sv-SE', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
          return (
            <div
              className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: 'var(--color-accent-soft)' }}
            >
              <Calendar size={14} color="var(--color-accent)" />
              <span className="text-[12px] font-bold" style={{ color: 'var(--color-accent)' }}>
                {occasion.name}
              </span>
              <span className="text-[12px]" style={{ color: 'var(--color-muted-light)' }}>
                · {formattedDate}
              </span>
              {days >= 0 && days <= 30 && (
                <span className="text-[12px] font-bold ml-auto" style={{ color: 'var(--color-accent)' }}>
                  {days === 0 ? 'Idag!' : `Om ${days} ${days === 1 ? 'dag' : 'dagar'}!`}
                </span>
              )}
            </div>
          );
        })()}

        {isParent && (
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setEditingItemId(null);
                setShowAddItem((v) => !v);
              }}
              className="light-cta-outline flex items-center gap-1.5"
            >
              <Plus size={12} /> {showAddItem ? 'Avbryt' : 'Lägg till önskemål'}
            </button>
            <Link
              href={`/wishlist/${wishlistId}/settings`}
              className="flex items-center gap-1.5 text-[13px] px-3 py-2 min-h-[40px]"
              style={{ color: 'var(--color-muted-light)' }}
            >
              <Cog size={14} /> Inställningar
            </Link>
          </div>
        )}
      </div>

      <div className="app-page app-bottom pt-5 mx-auto w-full max-w-2xl">
        {isParent && showAddItem && (
          <div className="mb-4">
            <ParentAddItemForm
              wishlistId={wishlistId}
              onClose={() => setShowAddItem(false)}
              onError={(msg) => setAddItemError(msg)}
            />
            {addItemError && (
              <p role="alert" className="mt-2 text-[13px]" style={{ color: 'var(--color-destructive)' }}>
                {addItemError}
              </p>
            )}
          </div>
        )}

        {itemActionError && (
          <p role="alert" className="mb-3 text-[13px]" style={{ color: 'var(--color-destructive)' }}>
            {itemActionError}
          </p>
        )}

        {items.length === 0 ? (
          <p
            className="text-center py-16 text-[14px]"
            style={{ color: 'var(--color-muted-light)' }}
          >
            Inga önskemål ännu.
          </p>
        ) : (
          <>
            {favoriteItems.length > 0 && (
              <section className="mb-6">
                <h2
                  className="flex items-center gap-1.5 text-[10px] font-bold tracking-caps mb-3 px-1"
                  style={{ color: 'var(--color-accent)' }}
                >
                  <Heart size={11} color="var(--color-accent)" /> Favoriter
                </h2>
                <ul role="list" className="flex flex-col gap-2.5">
                  {favoriteItems.map(renderCard)}
                </ul>
              </section>
            )}
            {otherItems.length > 0 && (
              <section>
                {favoriteItems.length > 0 && (
                  <h2
                    className="text-[10px] font-bold tracking-caps mb-3 px-1"
                    style={{ color: 'var(--color-muted-light)' }}
                  >
                    Övriga önskemål
                  </h2>
                )}
                <ul role="list" className="flex flex-col gap-2.5">
                  {otherItems.map(renderCard)}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </LightShell>
  );
}

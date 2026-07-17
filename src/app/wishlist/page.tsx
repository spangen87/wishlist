'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { getOrCreateWishlist, subscribeToItems, updateItemPosition } from '@/lib/firebase/wishlist';
import type { WishItemDoc } from '@/types/firestore';
import { WishItemCard } from '@/components/wishlist/WishItemCard';
import { AddItemForm } from '@/components/wishlist/AddItemForm';
import { EmptyState } from '@/components/wishlist/EmptyState';
import { LoadingSkeleton } from '@/components/wishlist/LoadingSkeleton';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCenter,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import {
  NightShell,
  BrandHeader,
  Cog,
  LogOut,
  Sparkle,
  Heart,
} from '@/components/galaxy';

export default function WishlistPage() {
  const router = useRouter();
  const { user, role, loading } = useAuth();
  const [items, setItems] = useState<WishItemDoc[]>([]);
  const [wishlistId, setWishlistId] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeItem, setActiveItem] = useState<WishItemDoc | null>(null);
  const wishlistIdRef = useRef<string | null>(null);

  const displayName = (() => {
    if (!user) return 'Min galax';
    const name = user.displayName || (user.email ? user.email.split('@')[0] : '');
    return name ? `${name}s galax` : 'Min galax';
  })();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 8,
      },
    })
  );

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  useEffect(() => {
    // Only child accounts own a wishlist here. Parents/viewers who land on
    // this URL must be sent away BEFORE getOrCreateWishlist runs, or a ghost
    // wishlist doc gets created with the adult's uid as childUid.
    if (!loading && user && role && role !== 'child') {
      router.push('/dashboard');
    }
  }, [loading, user, role, router]);

  useEffect(() => {
    if (loading || !user) return;
    if (role && role !== 'child') return; // redirecting — never create a list for an adult
    let unsubscribe: (() => void) | null = null;

    getOrCreateWishlist(user.uid).then((id) => {
      wishlistIdRef.current = id;
      setWishlistId(id);
      unsubscribe = subscribeToItems(id, (newItems) => {
        setItems(newItems);
        setDataLoading(false);
      });
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [loading, user, role]);

  function handleDragStart(event: { active: { id: string | number } }) {
    const found = items.find((i) => i.id === event.active.id);
    setActiveItem(found ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveItem(null);
    if (!over || active.id === over.id || !wishlistId) return;

    // Hearted items live in their own section above the rest, so reordering
    // is only meaningful within the same section.
    const activeDoc = items.find((i) => i.id === active.id);
    const overDoc = items.find((i) => i.id === over.id);
    if (!activeDoc || !overDoc || !!activeDoc.isFavorite !== !!overDoc.isFavorite) return;

    const group = items.filter((i) => !!i.isFavorite === !!activeDoc.isFavorite);
    const oldIndex = group.findIndex((i) => i.id === active.id);
    const newIndex = group.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const remaining = group.filter((i) => i.id !== active.id);
    const prevPos = remaining[newIndex - 1]?.position ?? null;
    const nextPos = remaining[newIndex]?.position ?? null;

    // Optimistic reorder so the card stays where it was dropped instead of
    // snapping back while the write is in flight; the Firestore subscription
    // remains the source of truth once the snapshot arrives. Only the
    // section's members move — they are written back into the array slots
    // they already occupy so the other section is untouched.
    const previousItems = items;
    const slots = items
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => !!item.isFavorite === !!activeDoc.isFavorite)
      .map(({ idx }) => idx);
    const reorderedGroup = arrayMove(group, oldIndex, newIndex);
    const optimistic = [...items];
    slots.forEach((slot, k) => {
      optimistic[slot] = reorderedGroup[k];
    });
    setItems(optimistic);

    try {
      await updateItemPosition(wishlistId, active.id as string, prevPos, nextPos);
    } catch {
      setItems(previousItems);
    }
  }

  if (loading || dataLoading) return <LoadingSkeleton />;
  if (!user) return null;

  const lastPosition = items.length > 0 ? items[items.length - 1].position : null;
  // Hearted items float to the top in their own section — same grouping the
  // parents/relatives see, so both sides read the list in the same order.
  const favoriteItems = items.filter((i) => i.isFavorite);
  const otherItems = items.filter((i) => !i.isFavorite);
  const totalFavorites = favoriteItems.length;
  const totalPhotos = items.filter((i) => !!i.photoData).length;
  const isEmpty = items.length === 0 && !showAddForm;

  return (
    <NightShell twinkleCount={28} auroraColor={isEmpty ? '#B28BFF' : '#FF7AB8'}>
      <div className="app-page app-top pb-3">
        <BrandHeader
          eyebrow={displayName.toUpperCase()}
          title="Önskestjärnor"
          mollyMood="happy"
          rightSlot={
            <>
              {wishlistId && (
                <a
                  href={`/wishlist/${wishlistId}/settings`}
                  aria-label="Inställningar för önskelistan"
                  className="flex items-center justify-center rounded-full"
                  style={{
                    width: 36,
                    height: 36,
                    background: 'var(--color-card)',
                    border: '1px solid var(--color-card-light)',
                    color: 'var(--color-muted)',
                  }}
                >
                  <Cog size={14} />
                </a>
              )}
              <button
                type="button"
                onClick={async () => {
                  await signOut(auth);
                  router.push('/login');
                }}
                aria-label="Logga ut"
                className="flex items-center justify-center rounded-full"
                style={{
                  width: 36,
                  height: 36,
                  background: 'var(--color-card)',
                  border: '1px solid var(--color-card-light)',
                  color: 'var(--color-muted)',
                }}
              >
                <LogOut size={14} />
              </button>
            </>
          }
        />
      </div>

      <div className="flex-1 app-page-x-tight app-bottom-fab pt-2 mx-auto w-full max-w-2xl no-overscroll">
        {isEmpty ? (
          <EmptyState onAdd={() => setShowAddForm(true)} />
        ) : (
          <>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              {favoriteItems.length > 0 && (
                <section className="mb-5">
                  <h2
                    className="flex items-center gap-1.5 text-[10px] font-bold tracking-caps mb-3 px-1"
                    style={{ color: 'var(--color-pink)' }}
                  >
                    <Heart size={11} color="var(--color-pink)" /> Favoriter
                  </h2>
                  <SortableContext
                    items={favoriteItems.map((i) => i.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <ul role="list" className="flex flex-col gap-2.5">
                      {favoriteItems.map((item, idx) => (
                        <WishItemCard
                          key={item.id}
                          item={item}
                          wishlistId={wishlistId!}
                          totalFavorites={totalFavorites}
                          totalPhotos={totalPhotos}
                          index={idx}
                        />
                      ))}
                    </ul>
                  </SortableContext>
                </section>
              )}
              {otherItems.length > 0 && (
                <section>
                  {favoriteItems.length > 0 && (
                    <h2
                      className="text-[10px] font-bold tracking-caps mb-3 px-1"
                      style={{ color: 'var(--color-muted)' }}
                    >
                      Övriga önskemål
                    </h2>
                  )}
                  <SortableContext
                    items={otherItems.map((i) => i.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <ul role="list" className="flex flex-col gap-2.5">
                      {otherItems.map((item, idx) => (
                        <WishItemCard
                          key={item.id}
                          item={item}
                          wishlistId={wishlistId!}
                          totalFavorites={totalFavorites}
                          totalPhotos={totalPhotos}
                          index={favoriteItems.length + idx}
                        />
                      ))}
                    </ul>
                  </SortableContext>
                </section>
              )}
              <DragOverlay>
                {activeItem ? (
                  <div className="opacity-90 rotate-1 shadow-xl">
                    <WishItemCard
                      item={activeItem}
                      wishlistId={wishlistId!}
                      totalFavorites={totalFavorites}
                      totalPhotos={totalPhotos}
                      index={0}
                    />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>

            {showAddForm && (
              <div className="mt-4">
                <AddItemForm
                  wishlistId={wishlistId!}
                  lastPosition={lastPosition}
                  photoCount={totalPhotos}
                  onClose={() => setShowAddForm(false)}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* FAB — fixed but offset using the dvh-svh delta to clear the iOS
          browser toolbar. When the URL/tab bar is visible 100svh < 100dvh,
          and that delta equals the toolbar height (env(safe-area-inset-bottom)
          returns 0 in that state in both Safari and Chrome iOS, so we can't
          use it). When the toolbar is collapsed the delta is 0, so we floor
          to a fixed safe-area offset. */}
      {!showAddForm && !isEmpty && (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          aria-label="Lägg till önskemål"
          className="anim-fab tap-feedback fixed z-20 flex items-center gap-2 font-display font-bold text-[14px]"
          style={{
            right: 'max(18px, env(safe-area-inset-right))',
            bottom:
              'max(20px, calc(100dvh - 100svh + 20px), calc(env(safe-area-inset-bottom, 0px) + 20px))',
            padding: '14px 22px',
            minHeight: 52,
            borderRadius: 9999,
            color: '#fff',
            background: 'linear-gradient(135deg, #FF7AB8, #B28BFF)',
            border: 'none',
          }}
        >
          <span className="anim-sparkle inline-flex">
            <Sparkle size={14} color="#fff" />
          </span>
          Önska
        </button>
      )}
    </NightShell>
  );
}

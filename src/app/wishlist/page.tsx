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
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import {
  NightShell,
  BrandHeader,
  Cog,
  LogOut,
  Sparkle,
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
    if (!loading && user && role === 'viewer') {
      router.push('/dashboard');
    }
  }, [loading, user, role, router]);

  useEffect(() => {
    if (loading || !user) return;
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
  }, [loading, user]);

  function handleDragStart(event: { active: { id: string | number } }) {
    const found = items.find((i) => i.id === event.active.id);
    setActiveItem(found ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveItem(null);
    if (!over || active.id === over.id || !wishlistId) return;

    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const remaining = items.filter((i) => i.id !== active.id);
    const insertAt = newIndex > oldIndex ? newIndex : newIndex;
    const prevPos = remaining[insertAt - 1]?.position ?? null;
    const nextPos = remaining[insertAt]?.position ?? null;

    await updateItemPosition(wishlistId, active.id as string, prevPos, nextPos);
  }

  if (loading || dataLoading) return <LoadingSkeleton />;
  if (!user) return null;

  const lastPosition = items.length > 0 ? items[items.length - 1].position : null;
  const totalFavorites = items.filter((i) => i.isFavorite).length;
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
              <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <ul role="list" className="flex flex-col gap-2.5">
                  {items.map((item, idx) => (
                    <WishItemCard
                      key={item.id}
                      item={item}
                      wishlistId={wishlistId!}
                      totalFavorites={totalFavorites}
                      index={idx}
                    />
                  ))}
                </ul>
              </SortableContext>
              <DragOverlay>
                {activeItem ? (
                  <div className="opacity-90 rotate-1 shadow-xl">
                    <WishItemCard
                      item={activeItem}
                      wishlistId={wishlistId!}
                      totalFavorites={totalFavorites}
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
                  onClose={() => setShowAddForm(false)}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* FAB */}
      {!showAddForm && !isEmpty && (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          aria-label="Lägg till önskemål"
          className="anim-fab tap-feedback fixed z-20 flex items-center gap-2 font-display font-bold text-[14px]"
          style={{
            right: 'max(18px, env(safe-area-inset-right))',
            /* iOS Safari URL/tab bar shrinks `100dvh` but `env(safe-area-inset-bottom)`
               returns 0 while the bar is visible — so a bare `env()` puts the FAB
               *behind* the toolbar. We bump the offset enough to clear it. */
            bottom: 'max(28px, calc(env(safe-area-inset-bottom, 0px) + 24px))',
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

'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
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

export default function WishlistPage() {
  const router = useRouter();
  const { user, role, loading } = useAuth();
  const [items, setItems] = useState<WishItemDoc[]>([]);
  const [wishlistId, setWishlistId] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeItem, setActiveItem] = useState<WishItemDoc | null>(null);
  const wishlistIdRef = useRef<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 8,
      },
    })
  );

  // Auth guard — same pattern as dashboard
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  // D-07: Viewer role users accessing /wishlist are redirected to their dashboard
  useEffect(() => {
    if (!loading && user && role === 'viewer') {
      router.push('/dashboard');
    }
  }, [loading, user, role, router]);

  // Bootstrap wishlist and subscribe to items
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

    // Compute adjacent positions for the target slot.
    // Use the sorted array excluding the dragged item to find neighbors.
    const remaining = items.filter((i) => i.id !== active.id);
    const insertAt = newIndex > oldIndex ? newIndex : newIndex;
    const prevPos = remaining[insertAt - 1]?.position ?? null;
    const nextPos = remaining[insertAt]?.position ?? null;

    // Pitfall 3 guard: skip if adjacent positions are equal (handled inside updateItemPosition)
    await updateItemPosition(wishlistId, active.id as string, prevPos, nextPos);
    // Do NOT update local `items` state here — onSnapshot will reflect the new order
  }

  if (loading || dataLoading) return <LoadingSkeleton />;
  if (!user) return null;

  const lastPosition = items.length > 0 ? items[items.length - 1].position : null;

  return (
    <main className="min-h-screen bg-[#FFF9F5] px-4 py-8 sm:px-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl font-semibold text-[#171717] mb-6">Din önskelista</h1>

        {items.length === 0 && !showAddForm ? (
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
                <ul role="list" className="flex flex-col gap-6">
                  {items.map((item) => (
                    <WishItemCard
                      key={item.id}
                      item={item}
                      wishlistId={wishlistId!}
                    />
                  ))}
                </ul>
              </SortableContext>
              <DragOverlay>
                {activeItem ? (
                  <div className="opacity-90 rotate-1 shadow-xl rounded-2xl">
                    <WishItemCard
                      item={activeItem}
                      wishlistId={wishlistId!}
                    />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>

            {showAddForm ? (
              <div className="mt-6">
                <AddItemForm
                  wishlistId={wishlistId!}
                  lastPosition={lastPosition}
                  onClose={() => setShowAddForm(false)}
                />
              </div>
            ) : (
              <div className="mt-6">
                <button
                  onClick={() => setShowAddForm(true)}
                  className="bg-[#F97316] hover:bg-[#EA6C0A] text-white rounded-xl px-4 py-2 font-semibold min-h-[44px] transition-colors"
                >
                  + Lägg till önskemål
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { getOrCreateWishlist, subscribeToItems } from '@/lib/firebase/wishlist';
import type { WishItemDoc } from '@/types/firestore';
import { WishItemCard } from '@/components/wishlist/WishItemCard';
import { AddItemForm } from '@/components/wishlist/AddItemForm';
import { EmptyState } from '@/components/wishlist/EmptyState';
import { LoadingSkeleton } from '@/components/wishlist/LoadingSkeleton';

export default function WishlistPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [items, setItems] = useState<WishItemDoc[]>([]);
  const [wishlistId, setWishlistId] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const wishlistIdRef = useRef<string | null>(null);

  // Auth guard — same pattern as dashboard
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

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
            <ul role="list" className="flex flex-col gap-6">
              {items.map((item) => (
                <WishItemCard
                  key={item.id}
                  item={item}
                  wishlistId={wishlistId!}
                  onEditStart={() => {}}
                />
              ))}
            </ul>

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

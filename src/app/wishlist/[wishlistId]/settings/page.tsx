'use client';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/components/AuthProvider';
import { ShareLinkPanel } from '@/components/viewer/ShareLinkPanel';
import Link from 'next/link';

export default function WishlistSettingsPage({
  params,
}: {
  params: Promise<{ wishlistId: string }>;
}) {
  const { wishlistId } = use(params);
  const router = useRouter();
  const { user, loading } = useAuth();

  const [viewers, setViewers] = useState<Array<{ uid: string; displayName: string }>>([]);
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  // Auth guard
  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  // Load wishlist + verify ownership + resolve viewer names
  useEffect(() => {
    if (loading || !user) return;

    async function loadSettings() {
      try {
        const wishlistSnap = await getDoc(doc(db, 'wishlists', wishlistId));
        if (!wishlistSnap.exists()) {
          router.push('/dashboard');
          return;
        }
        const data = wishlistSnap.data();
        if (data.childUid !== user!.uid) {
          // Not the owner — redirect away
          router.push('/dashboard');
          return;
        }

        setIsOwner(true);

        // Resolve viewer display names
        const viewerUids: string[] = data.viewerUids ?? [];
        const resolved = await Promise.all(
          viewerUids.map(async (uid) => {
            try {
              const uSnap = await getDoc(doc(db, 'users', uid));
              const uData = uSnap.data();
              return { uid, displayName: uData?.username ?? uData?.email ?? uid };
            } catch {
              return { uid, displayName: uid };
            }
          })
        );
        setViewers(resolved);
      } catch {
        router.push('/dashboard');
      } finally {
        setDataLoading(false);
      }
    }

    loadSettings();
  }, [loading, user, wishlistId, router]);

  if (loading || dataLoading) {
    return (
      <main className="min-h-screen bg-[#FFF9F5] flex items-center justify-center">
        <p className="text-[#6B7280]">Laddar…</p>
      </main>
    );
  }

  if (!user || !isOwner) return null;

  return (
    <main className="min-h-screen bg-[#FFF9F5] px-4 py-8 sm:px-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/wishlist"
            className="text-sm text-[#6B7280] hover:underline min-h-[44px] flex items-center"
          >
            ← Tillbaka till önskelistan
          </Link>
          <h1 className="text-xl font-semibold text-[#171717]">Inställningar</h1>
        </div>

        <ShareLinkPanel wishlistId={wishlistId} viewers={viewers} />
      </div>
    </main>
  );
}

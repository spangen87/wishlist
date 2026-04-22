'use client';
import { use, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, type QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/components/AuthProvider';
import { subscribeToActivityLog, getActivityLogPage } from '@/lib/firebase/viewer';
import { ActivityLogEntry } from '@/components/viewer/ActivityLogEntry';
import type { ActivityLogDoc } from '@/types/firestore';
import Link from 'next/link';

export default function ActivityLogPage({
  params,
}: {
  params: Promise<{ wishlistId: string }>;
}) {
  const { wishlistId } = use(params);
  const router = useRouter();
  const { user, role, loading } = useAuth();

  const [entries, setEntries] = useState<(ActivityLogDoc & { id?: string })[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [displayNames, setDisplayNames] = useState<Map<string, string>>(new Map());
  const [dataLoading, setDataLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);

  // Auth guards
  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && role === 'child') router.push('/wishlist');
  }, [loading, user, role, router]);

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
      // silent fail — fallback to uid
    }
  }, [displayNames]);

  useEffect(() => {
    if (loading || !user) return;

    const unsub = subscribeToActivityLog(wishlistId, (newEntries, newLastDoc) => {
      setEntries(newEntries);
      setLastDoc(newLastDoc);
      setHasMore(newEntries.length === 50);
      setDataLoading(false);
      newEntries.forEach((e) => fetchDisplayName(e.viewerUid));
    });

    return () => unsub();
  }, [loading, user, wishlistId, fetchDisplayName]);

  async function loadMore() {
    if (!lastDoc) return;
    const { entries: moreEntries, lastDoc: newLastDoc } = await getActivityLogPage(wishlistId, lastDoc);
    setEntries((prev) => [...prev, ...moreEntries]);
    setLastDoc(newLastDoc);
    setHasMore(moreEntries.length === 50);
    moreEntries.forEach((e) => fetchDisplayName(e.viewerUid));
  }

  if (loading || dataLoading) {
    return (
      <main className="min-h-screen bg-[#FFF9F5] flex items-center justify-center">
        <p className="text-[#6B7280]">Laddar…</p>
      </main>
    );
  }

  if (!user) return null;

  return (
    <main className="min-h-screen bg-[#FFF9F5] px-4 py-8 sm:px-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link
            href={`/viewer/${wishlistId}`}
            className="text-sm text-[#6B7280] hover:underline min-h-[44px] flex items-center"
          >
            ← Tillbaka till önskelista
          </Link>
          <h1 className="text-xl font-semibold text-[#171717]">Aktivitetslogg</h1>
        </div>

        {entries.length === 0 ? (
          <p className="text-base text-[#6B7280] text-center py-16">
            Inga händelser ännu
          </p>
        ) : (
          <>
            <ul role="list">
              {entries.map((entry, idx) => (
                <ActivityLogEntry
                  key={entry.id ?? idx}
                  entry={entry}
                  viewerDisplayName={displayNames.get(entry.viewerUid) ?? entry.viewerUid}
                />
              ))}
            </ul>

            {hasMore && (
              <div className="mt-6 text-center">
                <button
                  onClick={loadMore}
                  className="text-sm text-[#6B7280] hover:underline min-h-[44px]"
                >
                  Visa fler
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

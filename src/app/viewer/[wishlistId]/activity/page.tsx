'use client';
import { use, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, type QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/components/AuthProvider';
import { subscribeToActivityLog, getActivityLogPage } from '@/lib/firebase/viewer';
import { ActivityLogEntry } from '@/components/viewer/ActivityLogEntry';
import type { ActivityLogDoc } from '@/types/firestore';
import Link from 'next/link';
import { LightShell, ArrowLeft } from '@/components/galaxy';

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
  const fetchedNamesRef = useRef(new Set<string>());

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && role === 'child') router.push('/wishlist');
  }, [loading, user, role, router]);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, wishlistId]);

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
      <LightShell>
        <div className="flex min-h-[100dvh] items-center justify-center">
          <p style={{ color: 'var(--color-muted-light)' }}>Laddar…</p>
        </div>
      </LightShell>
    );
  }

  if (!user) return null;

  return (
    <LightShell>
      <header
        className="px-5 pt-6 pb-4"
        style={{ borderBottom: '1px solid var(--color-border-light)', background: '#fff' }}
      >
        <Link
          href={`/viewer/${wishlistId}`}
          aria-label="Tillbaka till önskelista"
          className="flex items-center gap-1.5 text-[12px]"
          style={{ color: 'var(--color-muted-light)' }}
        >
          <ArrowLeft size={14} /> Tillbaka
        </Link>
        <h1 className="font-display font-bold text-[22px] mt-1.5">Aktivitet</h1>
      </header>

      <div className="mx-auto w-full max-w-2xl pb-12">
        {entries.length === 0 ? (
          <p
            className="text-center py-16 text-[14px]"
            style={{ color: 'var(--color-muted-light)' }}
          >
            Inga händelser ännu
          </p>
        ) : (
          <>
            <ul role="list" className="pt-2">
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
                  type="button"
                  onClick={loadMore}
                  className="text-[13px] font-semibold"
                  style={{ color: 'var(--color-accent)' }}
                >
                  Visa fler
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </LightShell>
  );
}

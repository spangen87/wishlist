'use client';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/client';
import { useAuth } from '@/components/AuthProvider';
import { ShareLinkPanel } from '@/components/viewer/ShareLinkPanel';
import Link from 'next/link';

// Co-förälder invite section — mirrors ShareLinkPanel UX, calls /api/invite/create-for-parent
function CoParentInviteSection({
  wishlistId,
  initialToken,
}: {
  wishlistId: string;
  initialToken: string | null;
}) {
  const [token, setToken] = useState<string | null>(initialToken);
  const [copyLabel, setCopyLabel] = useState('Kopiera länk');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inviteUrl =
    token && typeof window !== 'undefined'
      ? `${window.location.origin}/invite/${token}`
      : null;

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/invite/create-for-parent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, wishlistId }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setToken(data.token);
    } catch {
      setError('Något gick fel. Försök igen.');
    } finally {
      setCreating(false);
    }
  }

  async function handleCopy() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopyLabel('Kopierat!');
      setTimeout(() => setCopyLabel('Kopiera länk'), 2000);
    } catch {
      setError('Kunde inte kopiera länken.');
    }
  }

  return (
    <section className="bg-[#FFF0E8] border border-[#E5D5CC] rounded-2xl p-6 mt-6">
      <h2 className="text-xl font-semibold text-[#171717]">Co-förälder</h2>
      <p className="mt-1 text-sm text-[#6B7280]">
        Dela denna länk med en annan förälder för att ge dem full tillgång att hantera önskelistan.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-sm text-[#DC2626]">
          {error}
        </p>
      )}
      {token ? (
        <div className="mt-4 flex gap-2 items-center flex-wrap">
          <input
            type="text"
            readOnly
            value={inviteUrl ?? ''}
            aria-label="Co-förälderlänk"
            className="flex-1 min-w-0 border border-[#E5D5CC] rounded-md px-3 py-2 text-sm text-[#171717] bg-white font-mono"
          />
          <button
            onClick={handleCopy}
            aria-live="polite"
            className="bg-[#F97316] hover:bg-[#EA6C0A] text-white rounded-xl px-4 py-2 font-semibold text-sm min-h-[44px] transition-colors flex-shrink-0"
          >
            {copyLabel}
          </button>
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-sm text-[#6B7280] mb-3">Ingen co-förälderlänk är skapad ännu.</p>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="bg-[#F97316] hover:bg-[#EA6C0A] text-white rounded-xl px-4 py-2 font-semibold text-sm min-h-[44px] transition-colors disabled:opacity-50"
          >
            {creating ? 'Skapar…' : 'Skapa co-förälderlänk'}
          </button>
        </div>
      )}
    </section>
  );
}

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
  const [accessType, setAccessType] = useState<'child' | 'parent' | null>(null);
  const [initialParentToken, setInitialParentToken] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  // Load wishlist + verify access (owner or parentUids member) + resolve viewer names
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

        // Gate: allow child owner AND parentUids members (D-17)
        const parentUids: string[] = data.parentUids ?? [];
        const callerIsOwner = data.childUid === user!.uid;
        const callerIsParent = parentUids.includes(user!.uid);
        if (!callerIsOwner && !callerIsParent) {
          router.push('/dashboard');
          return;
        }

        setIsOwner(true); // "isOwner" means "has settings access" — true for child and parent
        setAccessType(callerIsOwner ? 'child' : 'parent');

        // Read initial parent invite token for CoParentInviteSection (D-18)
        setInitialParentToken(data.currentParentInviteToken ?? null);

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
          {/* Back link is context-aware: parents go to viewer page, children go to wishlist (D-19) */}
          <Link
            href={accessType === 'parent' ? `/viewer/${wishlistId}` : '/wishlist'}
            className="text-sm text-[#6B7280] hover:underline min-h-[44px] flex items-center"
          >
            ← Tillbaka
          </Link>
          <h1 className="text-xl font-semibold text-[#171717]">Inställningar</h1>
        </div>

        <ShareLinkPanel wishlistId={wishlistId} viewers={viewers} />
        <CoParentInviteSection wishlistId={wishlistId} initialToken={initialParentToken} />
      </div>
    </main>
  );
}

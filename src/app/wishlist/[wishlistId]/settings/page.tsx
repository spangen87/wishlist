'use client';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/client';
import { useAuth } from '@/components/AuthProvider';
import { ShareLinkPanel } from '@/components/viewer/ShareLinkPanel';
import Link from 'next/link';
import { LightShell, ArrowLeft, Calendar, UserIcon } from '@/components/galaxy';

function OccasionSection({
  wishlistId,
  initialOccasion,
}: {
  wishlistId: string;
  initialOccasion: { name: string; date: string } | null;
}) {
  const [name, setName] = useState(initialOccasion?.name ?? '');
  const [date, setDate] = useState(initialOccasion?.date ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName && !date) {
      await persist(null);
      return;
    }
    if (!trimmedName || !date) {
      setError('Fyll i både tillfälle och datum, eller lämna båda tomma för att ta bort.');
      return;
    }
    await persist({ name: trimmedName, date });
  }

  async function persist(occasion: { name: string; date: string } | null) {
    setSaving(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/wishlist/update-occasion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, wishlistId, occasion }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError('Något gick fel. Försök igen.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="light-card p-5">
      <div className="flex items-center gap-2">
        <Calendar size={16} color="var(--color-accent)" />
        <h2 className="font-display font-bold text-[16px]">Tillfälle</h2>
      </div>
      <p className="mt-1 text-[12px]" style={{ color: 'var(--color-muted-light)' }}>
        Ange vilket tillfälle önskelistan gäller — visas för anhöriga.
      </p>
      <form onSubmit={handleSave} className="mt-4 flex flex-col gap-3">
        <div>
          <label
            htmlFor="occasion-name"
            className="block mb-1.5 text-[10px] font-bold tracking-caps"
            style={{ color: 'var(--color-muted-light)' }}
          >
            Tillfälle
          </label>
          <input
            id="occasion-name"
            type="text"
            list="occasion-suggestions"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="t.ex. Födelsedag"
            className="light-input"
          />
          <datalist id="occasion-suggestions">
            <option value="Födelsedag" />
            <option value="Jul" />
            <option value="Påsk" />
            <option value="Studentdag" />
            <option value="Namnsdagen" />
          </datalist>
        </div>
        <div>
          <label
            htmlFor="occasion-date"
            className="block mb-1.5 text-[10px] font-bold tracking-caps"
            style={{ color: 'var(--color-muted-light)' }}
          >
            Datum
          </label>
          <input
            id="occasion-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="light-input"
          />
        </div>
        {error && (
          <p role="alert" className="text-[13px]" style={{ color: 'var(--color-destructive)' }}>
            {error}
          </p>
        )}
        <button type="submit" disabled={saving} className="light-cta self-start">
          {saving ? 'Sparar…' : saved ? 'Sparat!' : 'Spara'}
        </button>
      </form>
    </section>
  );
}

function CoParentInviteSection({
  wishlistId,
  initialToken,
}: {
  wishlistId: string;
  initialToken: string | null;
}) {
  const [token, setToken] = useState<string | null>(initialToken);
  const [copyLabel, setCopyLabel] = useState('Kopiera');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inviteUrl =
    token && typeof window !== 'undefined' ? `${window.location.origin}/invite/${token}` : null;

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
      setTimeout(() => setCopyLabel('Kopiera'), 2000);
    } catch {
      setError('Kunde inte kopiera länken.');
    }
  }

  return (
    <section className="light-card p-5">
      <div className="flex items-center gap-2">
        <UserIcon size={16} color="var(--color-accent)" />
        <h2 className="font-display font-bold text-[16px]">Co-förälder</h2>
      </div>
      <p className="mt-1 text-[12px]" style={{ color: 'var(--color-muted-light)' }}>
        Ge en annan förälder full tillgång att hantera önskelistan.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-[13px]" style={{ color: 'var(--color-destructive)' }}>
          {error}
        </p>
      )}
      {token ? (
        <div
          className="mt-4 flex items-center gap-2 rounded-xl px-3 py-2.5"
          style={{
            background: 'var(--color-accent-soft)',
            border: '1px dashed var(--color-border-light)',
          }}
        >
          <input
            type="text"
            readOnly
            value={inviteUrl ?? ''}
            aria-label="Co-förälderlänk"
            className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[12px] font-mono"
            style={{ color: 'var(--color-ink-light)' }}
          />
          <button
            type="button"
            onClick={handleCopy}
            aria-live="polite"
            className="text-[12px] font-bold px-2.5 py-1.5 rounded-md"
            style={{ color: 'var(--color-accent)' }}
          >
            {copyLabel}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleCreate}
          disabled={creating}
          className="light-cta-outline mt-4"
        >
          {creating ? 'Skapar…' : 'Skapa co-förälderlänk'}
        </button>
      )}
    </section>
  );
}

function DangerZone({ wishlistId, childUid }: { wishlistId: string; childUid: string }) {
  const router = useRouter();
  const [deletingList, setDeletingList] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDeleteWishlist() {
    if (
      !window.confirm(
        'Är du säker på att du vill ta bort önskelistan? Alla önskningar och all köpinformation raderas permanent.'
      )
    )
      return;
    setDeletingList(true);
    setError(null);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/wishlist/${wishlistId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok) throw new Error();
      router.push('/dashboard');
    } catch {
      setError('Något gick fel. Försök igen.');
    } finally {
      setDeletingList(false);
    }
  }

  async function handleDeleteChildAccount() {
    if (
      !window.confirm(
        'Är du säker på att du vill ta bort barnkontot? Kontot, önskelistan och all data raderas permanent och kan inte återställas.'
      )
    )
      return;
    setDeletingAccount(true);
    setError(null);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/auth/user/${childUid}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok) throw new Error();
      router.push('/dashboard');
    } catch {
      setError('Något gick fel. Försök igen.');
    } finally {
      setDeletingAccount(false);
    }
  }

  return (
    <section
      className="rounded-[18px] p-5"
      style={{
        background: 'var(--color-destructive-soft)',
        border: '1px solid #FECACA',
      }}
    >
      <h2 className="font-display font-bold text-[16px]" style={{ color: 'var(--color-destructive)' }}>
        Fara
      </h2>
      <p className="mt-1 text-[12px]" style={{ color: 'var(--color-muted-light)' }}>
        Dessa åtgärder är permanenta och kan inte ångras.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-[13px]" style={{ color: 'var(--color-destructive)' }}>
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-col gap-2.5">
        <button
          type="button"
          onClick={handleDeleteWishlist}
          disabled={deletingList || deletingAccount}
          className="rounded-xl px-4 py-3 text-[13px] font-bold text-white disabled:opacity-50"
          style={{ background: 'var(--color-destructive)' }}
        >
          {deletingList ? 'Tar bort…' : 'Ta bort önskelistan'}
        </button>
        <button
          type="button"
          onClick={handleDeleteChildAccount}
          disabled={deletingList || deletingAccount}
          className="rounded-xl px-4 py-3 text-[13px] font-bold text-white disabled:opacity-50"
          style={{ background: 'var(--color-destructive)' }}
        >
          {deletingAccount ? 'Tar bort…' : 'Ta bort barnkonto'}
        </button>
      </div>
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
  const [initialOccasion, setInitialOccasion] = useState<{ name: string; date: string } | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

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

        const parentUids: string[] = data.parentUids ?? [];
        const callerIsOwner = data.childUid === user!.uid;
        const callerIsParent = parentUids.includes(user!.uid);
        if (!callerIsOwner && !callerIsParent) {
          router.push('/dashboard');
          return;
        }

        setIsOwner(true);
        setAccessType(callerIsOwner ? 'child' : 'parent');
        setInitialParentToken(data.currentParentInviteToken ?? null);
        setInitialOccasion(data.occasion ?? null);

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
      <LightShell>
        <div className="flex min-h-[100dvh] items-center justify-center">
          <p style={{ color: 'var(--color-muted-light)' }}>Laddar…</p>
        </div>
      </LightShell>
    );
  }

  if (!user || !isOwner) return null;

  return (
    <LightShell>
      <header
        className="flex items-center gap-3 px-5 pt-6 pb-4"
        style={{ borderBottom: '1px solid var(--color-border-light)', background: '#fff' }}
      >
        <Link
          href={accessType === 'parent' ? `/viewer/${wishlistId}` : '/wishlist'}
          aria-label="Tillbaka"
          className="flex items-center justify-center min-h-[44px] min-w-[44px]"
          style={{ color: 'var(--color-muted-light)' }}
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="font-display font-bold text-[20px]">Inställningar</h1>
        </div>
      </header>

      <div className="px-4 pt-5 pb-12 mx-auto w-full max-w-2xl flex flex-col gap-3">
        <OccasionSection wishlistId={wishlistId} initialOccasion={initialOccasion} />
        <ShareLinkPanel wishlistId={wishlistId} viewers={viewers} />
        <CoParentInviteSection wishlistId={wishlistId} initialToken={initialParentToken} />
        {accessType === 'parent' && (
          <DangerZone wishlistId={wishlistId} childUid={wishlistId} />
        )}
      </div>
    </LightShell>
  );
}

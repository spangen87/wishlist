'use client';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { useAuth } from '@/components/AuthProvider';
import { LightShell, ArrowLeft } from '@/components/galaxy';
import { OCCASION_SUGGESTIONS } from '@/lib/wishlist-kind';

export default function AddListPage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string }>;
}) {
  // ?child=<uid>: one more list for an existing child account. Without it the
  // list has no account behind it. The server checks that the caller is a
  // parent of the child either way.
  const { child: childUid } = use(searchParams);
  const router = useRouter();
  const { user, role, loading } = useAuth();
  const [childName, setChildName] = useState('');

  const [title, setTitle] = useState('');
  const [occasionName, setOccasionName] = useState('');
  const [occasionDate, setOccasionDate] = useState('');
  const [hidePurchases, setHidePurchases] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && role === 'child') router.push('/wishlist');
  }, [loading, user, role, router]);

  useEffect(() => {
    if (loading || !user || !childUid) return;
    getDoc(doc(db, 'users', childUid))
      .then((snap) => {
        const data = snap.data();
        setChildName(data?.displayName ?? data?.username ?? '');
      })
      .catch(() => { /* the heading just falls back to "barnet" */ });
  }, [loading, user, childUid]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Ge listan ett namn.');
      return;
    }
    const trimmedOccasion = occasionName.trim();
    if (!!trimmedOccasion !== !!occasionDate) {
      setError('Fyll i både tillfälle och datum, eller lämna båda tomma.');
      return;
    }

    setSaving(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        setError('Sessionen har gått ut. Logga in igen.');
        return;
      }
      const res = await fetch('/api/wishlist/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken,
          title: trimmedTitle,
          ...(childUid ? { childUid } : { hidePurchases }),
          occasion: trimmedOccasion ? { name: trimmedOccasion, date: occasionDate } : null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Något gick fel. Försök igen.');
        return;
      }
      const { wishlistId } = await res.json();
      router.push(`/viewer/${wishlistId}`);
    } catch {
      setError('Något gick fel. Försök igen.');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user) {
    return (
      <LightShell>
        <div className="flex min-h-[100dvh] items-center justify-center">
          <p style={{ color: 'var(--color-muted-light)' }}>Laddar…</p>
        </div>
      </LightShell>
    );
  }

  return (
    <LightShell>
      <header
        className="app-sticky flex items-center gap-3 app-page app-top pb-4"
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
        <h1 className="font-display font-bold text-[20px] min-w-0 truncate">
          {childUid ? `Ny lista för ${childName || 'barnet'}` : 'Skapa lista utan konto'}
        </h1>
      </header>

      <div className="flex-1 app-page app-bottom pt-6">
        <div className="mx-auto w-full max-w-sm">
          <p
            className="mb-7 rounded-2xl px-4 py-3.5 text-[15px] leading-relaxed"
            style={{ background: 'var(--color-accent-soft)', color: 'var(--color-ink-light)' }}
          >
            {childUid ? (
              <>
                En till önskelista för {childName || 'barnet'} — t.ex. inför jul
                eller födelsedagen. {childName || 'Barnet'} ser den när hen loggar
                in och kan önska i den precis som i sin första lista. Alla föräldrar
                kommer åt den direkt, gäster bjuder du in med listans egen länk.
              </>
            ) : (
              <>
                En önskelista som du sköter själv — ingen behöver logga in. Bra för
                små barn, men funkar lika bra till dop, bröllop eller inflyttningsfest.
              </>
            )}
          </p>

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
            <div>
              <label
                htmlFor="list-title"
                className="flex items-center gap-2 mb-1.5 text-[14px] font-bold"
                style={{ color: 'var(--color-ink-light)' }}
              >
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: '#FF7AB8' }}
                />
                Namn på listan
              </label>
              <input
                id="list-title"
                type="text"
                required
                autoFocus
                maxLength={60}
                aria-describedby="list-title-hint"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="light-input"
                style={{ boxShadow: 'inset 0 0 0 1px #FF7AB866' }}
              />
              <p
                id="list-title-hint"
                className="mt-1.5 text-[13px] leading-snug"
                style={{ color: 'var(--color-muted-light)' }}
              >
                {childUid
                  ? 'T.ex. "Julklappar" eller "Födelsedag". Visas för alla du bjuder in.'
                  : 'T.ex. "Vilmas önskelista" eller "Vårt bröllop". Visas för alla du bjuder in.'}
              </p>
            </div>

            <div>
              <label
                htmlFor="list-occasion"
                className="flex items-center gap-2 mb-1.5 text-[14px] font-bold"
                style={{ color: 'var(--color-ink-light)' }}
              >
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: '#7DE3FF' }}
                />
                Tillfälle <span className="font-normal" style={{ color: 'var(--color-muted-light)' }}>(valfritt)</span>
              </label>
              <input
                id="list-occasion"
                type="text"
                list="add-list-occasions"
                value={occasionName}
                onChange={(e) => setOccasionName(e.target.value)}
                placeholder="t.ex. Dop"
                className="light-input"
                style={{ boxShadow: 'inset 0 0 0 1px #7DE3FF66' }}
              />
              <datalist id="add-list-occasions">
                {OCCASION_SUGGESTIONS.map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
            </div>

            <div>
              <label
                htmlFor="list-date"
                className="flex items-center gap-2 mb-1.5 text-[14px] font-bold"
                style={{ color: 'var(--color-ink-light)' }}
              >
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: '#FFD36E' }}
                />
                Datum <span className="font-normal" style={{ color: 'var(--color-muted-light)' }}>(valfritt)</span>
              </label>
              <input
                id="list-date"
                type="date"
                value={occasionDate}
                onChange={(e) => setOccasionDate(e.target.value)}
                className="light-input"
                style={{ boxShadow: 'inset 0 0 0 1px #FFD36E66' }}
              />
            </div>

            {/* Surprise mode only exists for lists without an account — a child
                never sees purchases, and their parents need to. */}
            {!childUid && (
              <div
                className="rounded-2xl p-4"
                style={{ background: '#fff', border: '1px solid var(--color-border-light)' }}
              >
                <label htmlFor="list-hide-purchases" className="flex items-start gap-3 cursor-pointer">
                  <input
                    id="list-hide-purchases"
                    type="checkbox"
                    checked={hidePurchases}
                    onChange={(e) => setHidePurchases(e.target.checked)}
                    aria-describedby="list-hide-purchases-hint"
                    className="mt-0.5 shrink-0"
                    style={{ width: 20, height: 20, accentColor: 'var(--color-accent)' }}
                  />
                  <span>
                    <span className="block text-[14px] font-bold" style={{ color: 'var(--color-ink-light)' }}>
                      Jag vill bli överraskad
                    </span>
                    <span
                      id="list-hide-purchases-hint"
                      className="mt-1 block text-[13px] leading-snug"
                      style={{ color: 'var(--color-muted-light)' }}
                    >
                      Dölj vad som är köpt och reserverat för dig själv. Gästerna ser
                      det fortfarande och slipper köpa dubbelt. Passar när listan är
                      din egen — t.ex. till bröllop. Du kan ändra det här när som helst.
                    </span>
                  </span>
                </label>
              </div>
            )}

            {error && (
              <p
                role="alert"
                className="rounded-xl px-3.5 py-2.5 text-[14px] font-semibold leading-snug"
                style={{ background: 'var(--color-destructive-soft)', color: 'var(--color-destructive)' }}
              >
                {error}
              </p>
            )}

            <button type="submit" disabled={saving} className="light-cta mt-1">
              {saving ? 'Skapar…' : 'Skapa listan →'}
            </button>
          </form>
        </div>
      </div>
    </LightShell>
  );
}

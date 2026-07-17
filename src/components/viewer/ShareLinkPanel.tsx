'use client';
import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase/client';
import { LinkIcon } from '@/components/galaxy';

interface ShareLinkPanelProps {
  wishlistId: string;
  viewers: Array<{ uid: string; displayName: string }>;
}

const VIEWER_COLORS = ['#6E5BE8', '#FF7AB8', '#7DE3FF', '#85F2CA', '#FFD36E'];

function pickColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return VIEWER_COLORS[h % VIEWER_COLORS.length];
}

export function ShareLinkPanel({ wishlistId, viewers }: ShareLinkPanelProps) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copyLabel, setCopyLabel] = useState('Kopiera');
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewerList, setViewerList] = useState(viewers);
  const [removingUid, setRemovingUid] = useState<string | null>(null);

  useEffect(() => {
    setViewerList(viewers);
  }, [viewers]);

  const inviteUrl = token
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${token}`
    : null;

  useEffect(() => {
    async function fetchToken() {
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) return;
        const res = await fetch(
          `/api/invite/current?wishlistId=${encodeURIComponent(wishlistId)}`,
          { headers: { Authorization: `Bearer ${idToken}` } }
        );
        if (res.ok) {
          const data = await res.json();
          setToken(data.token);
        }
      } catch {
        setError('Kunde inte hämta delningslänk.');
      } finally {
        setLoading(false);
      }
    }
    fetchToken();
  }, [wishlistId]);

  async function handleCreateLink() {
    setLoading(true);
    setError(null);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/invite/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, wishlistId }),
      });
      if (!res.ok) throw new Error('Failed to create link');
      const data = await res.json();
      setToken(data.token);
    } catch {
      setError('Något gick fel. Försök igen.');
    } finally {
      setLoading(false);
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

  async function handleRemoveViewer(uid: string, displayName: string) {
    if (!window.confirm(`Ta bort ${displayName} från listan? Personen ser inte längre önskelistan.`)) {
      return;
    }
    setRemovingUid(uid);
    setError(null);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/wishlist/remove-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, wishlistId, memberUid: uid, memberType: 'viewer' }),
      });
      if (!res.ok) throw new Error('Failed to remove viewer');
      setViewerList((prev) => prev.filter((v) => v.uid !== uid));
    } catch {
      setError('Kunde inte ta bort personen. Försök igen.');
    } finally {
      setRemovingUid(null);
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    setError(null);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/invite/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, wishlistId }),
      });
      if (!res.ok) throw new Error('Failed to regenerate');
      const data = await res.json();
      setToken(data.token);
      setShowRegenConfirm(false);
    } catch {
      setError('Något gick fel. Försök igen.');
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <section className="light-card p-5">
      <div className="flex items-center gap-2">
        <LinkIcon size={16} color="var(--color-accent)" />
        <h2 className="font-display font-bold text-[16px]">Delningslänk</h2>
      </div>
      <p className="mt-1 text-[12px]" style={{ color: 'var(--color-muted-light)' }}>
        Dela med mormor, farfar och vänner
      </p>

      {error && (
        <p role="alert" className="mt-3 text-[13px]" style={{ color: 'var(--color-destructive)' }}>
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-4 text-[13px]" style={{ color: 'var(--color-muted-light)' }}>
          Laddar…
        </p>
      ) : token ? (
        <>
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
              size={1}
              value={inviteUrl ?? ''}
              aria-label="Delningslänk"
              className="flex-1 min-w-0 w-0 bg-transparent border-0 outline-none text-[16px] font-mono"
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

          <div className="mt-4">
            {!showRegenConfirm ? (
              <button
                type="button"
                onClick={() => setShowRegenConfirm(true)}
                className="text-[12px]"
                style={{ color: 'var(--color-muted-light)' }}
              >
                Generera ny länk
              </button>
            ) : (
              <div role="alert" className="flex flex-wrap gap-3 items-center">
                <span className="text-[13px]" style={{ color: 'var(--color-ink-light)' }}>
                  Gamla länken slutar fungera. Fortsätt?
                </span>
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={regenerating}
                  className="text-[13px] font-bold disabled:opacity-50"
                  style={{ color: 'var(--color-destructive)' }}
                >
                  {regenerating ? 'Genererar…' : 'Ja, generera ny'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRegenConfirm(false)}
                  className="text-[13px]"
                  style={{ color: 'var(--color-muted-light)' }}
                >
                  Avbryt
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="mt-4">
          <p className="text-[13px] mb-3" style={{ color: 'var(--color-muted-light)' }}>
            Generera en delningslänk för att bjuda in betraktare.
          </p>
          <button
            type="button"
            onClick={handleCreateLink}
            disabled={loading}
            className="light-cta-outline"
          >
            Skapa delningslänk
          </button>
        </div>
      )}

      {viewerList.length > 0 && (
        <div className="mt-5">
          <h3
            className="text-[10px] font-bold tracking-caps mb-2"
            style={{ color: 'var(--color-muted-light)' }}
          >
            Betraktare ({viewerList.length})
          </h3>
          <ul className="flex flex-wrap gap-2">
            {viewerList.map(({ uid, displayName }) => {
              const accent = pickColor(uid);
              const initial = displayName.slice(0, 1).toUpperCase();
              return (
                <li
                  key={uid}
                  className="flex items-center gap-2 rounded-full pl-1 pr-1.5 py-1"
                  style={{ background: `${accent}1f` }}
                >
                  <span
                    className="flex items-center justify-center font-bold"
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: accent,
                      color: '#fff',
                      fontSize: 11,
                    }}
                  >
                    {initial}
                  </span>
                  <span className="text-[12px] font-semibold" style={{ color: accent }}>
                    {displayName}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveViewer(uid, displayName)}
                    disabled={removingUid === uid}
                    aria-label={`Ta bort ${displayName}`}
                    className="flex items-center justify-center rounded-full disabled:opacity-50"
                    style={{
                      width: 20,
                      height: 20,
                      color: accent,
                      fontSize: 14,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

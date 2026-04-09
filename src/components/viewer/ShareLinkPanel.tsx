'use client';
import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase/client';

interface ShareLinkPanelProps {
  wishlistId: string;
  viewers: Array<{ uid: string; displayName: string }>;  // pre-resolved by parent
}

export function ShareLinkPanel({ wishlistId, viewers }: ShareLinkPanelProps) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copyLabel, setCopyLabel] = useState('Kopiera länk');
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inviteUrl = token
    ? `${window.location.origin}/invite/${token}`
    : null;

  // Fetch current active token on mount
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
      setTimeout(() => setCopyLabel('Kopiera länk'), 2000);
    } catch {
      setError('Kunde inte kopiera länken.');
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
    <section className="bg-[#FFF0E8] border border-[#E5D5CC] rounded-2xl p-6">
      <h2 className="text-xl font-semibold text-[#171717]">Delningslänk</h2>

      {error && (
        <p role="alert" className="mt-2 text-sm text-[#DC2626]">{error}</p>
      )}

      {loading ? (
        <p className="mt-4 text-sm text-[#6B7280]">Laddar…</p>
      ) : token ? (
        <>
          {/* Link display + copy */}
          <div className="mt-4 flex gap-2 items-center flex-wrap">
            <input
              type="text"
              readOnly
              value={inviteUrl ?? ''}
              className="flex-1 min-w-0 border border-[#E5D5CC] rounded-md px-3 py-2 text-sm text-[#171717] bg-white font-mono"
              aria-label="Delningslänk"
            />
            <button
              onClick={handleCopy}
              className="bg-[#F97316] hover:bg-[#EA6C0A] text-white rounded-xl px-4 py-2 font-semibold text-sm min-h-[44px] transition-colors flex-shrink-0"
              aria-live="polite"
            >
              {copyLabel}
            </button>
          </div>

          {/* Regenerate section */}
          <div className="mt-4">
            {!showRegenConfirm ? (
              <button
                onClick={() => setShowRegenConfirm(true)}
                className="border border-[#E5D5CC] text-[#171717] rounded-xl px-4 py-2 text-sm min-h-[44px] hover:bg-[#FFF9F5] transition-colors"
              >
                Generera ny länk
              </button>
            ) : (
              <div role="alert" className="flex flex-wrap gap-3 items-center">
                <span className="text-sm text-[#171717]">
                  Gamla länken slutar fungera. Fortsätt?
                </span>
                <button
                  onClick={handleRegenerate}
                  disabled={regenerating}
                  className="text-sm text-[#DC2626] hover:underline min-h-[44px] disabled:opacity-50"
                >
                  {regenerating ? 'Genererar…' : 'Ja, generera ny länk'}
                </button>
                <button
                  onClick={() => setShowRegenConfirm(false)}
                  className="text-sm text-[#6B7280] hover:underline min-h-[44px]"
                >
                  Avbryt
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        /* No active invite yet — create first one */
        <div className="mt-4">
          <p className="text-sm text-[#6B7280] mb-3">
            Generera en delningslänk för att bjuda in betraktare.
          </p>
          <button
            onClick={handleCreateLink}
            disabled={loading}
            className="bg-[#F97316] hover:bg-[#EA6C0A] text-white rounded-xl px-4 py-2 font-semibold text-sm min-h-[44px] transition-colors disabled:opacity-50"
          >
            Skapa delningslänk
          </button>
        </div>
      )}

      {/* Viewer list */}
      {viewers.length > 0 && (
        <div className="mt-6">
          <h3 className="text-base font-semibold text-[#171717]">
            Betraktare ({viewers.length})
          </h3>
          <ul className="mt-2 flex flex-col gap-1">
            {viewers.map(({ uid, displayName }) => (
              <li key={uid} className="text-sm text-[#6B7280]">
                {displayName}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

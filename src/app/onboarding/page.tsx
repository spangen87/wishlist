'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase/client';
import { useAuth } from '@/components/AuthProvider';
import { ChildAccountForm } from '@/components/onboarding/ChildAccountForm';

type WizardState = {
  step: 1 | 2 | 3;
  wishlistId: string | null;
};

// Step progress dots (UI-SPEC: 8px dots, accent fill for active, border-color for inactive)
function StepDots({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="flex justify-center gap-2 mb-6" aria-label={`Steg ${step} av 3`}>
      {([1, 2, 3] as const).map((n) => (
        <span
          key={n}
          className={`w-2 h-2 rounded-full ${n === step ? 'bg-[#F9A87A]' : 'bg-[#E5D5CC]'}`}
          aria-current={n === step ? 'step' : undefined}
        />
      ))}
    </div>
  );
}

// Step 2: Name the wishlist
function Step2({
  wishlistId,
  onDone,
}: {
  wishlistId: string;
  onDone: () => void;
}) {
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError('Ange ett namn på önskelistan');
      return;
    }
    setLoading(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        setError('Något gick fel. Försök igen.');
        return;
      }
      const res = await fetch('/api/wishlist/update-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, wishlistId, title: title.trim() }),
      });
      if (!res.ok) {
        setError('Något gick fel. Försök igen.');
        return;
      }
      onDone();
    } catch {
      setError('Något gick fel. Försök igen.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="wishlistTitle" className="block text-sm mb-1">
          Namn på önskelistan
        </label>
        <input
          id="wishlistTitle"
          type="text"
          placeholder="t.ex. Elsas önskelista"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border border-[#E5D5CC] rounded px-3 py-2"
        />
      </div>
      {error && (
        <p role="alert" className="text-[#DC2626] text-sm">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-xl px-4 py-2 font-semibold min-h-[44px] transition-colors disabled:opacity-50"
      >
        {loading ? 'Sparar…' : 'Spara och fortsätt'}
      </button>
    </form>
  );
}

// Step 3: Share link — uses /api/invite/create-for-child (not ShareLinkPanel, which enforces child ownership)
// D-02 override: ShareLinkPanel calls /api/invite/current which enforces childUid === decoded.uid,
// blocking the viewer/parent session. This inline component calls /api/invite/create-for-child instead.
// User approved this deviation (see decision_overrides block in 01-02-PLAN.md).
function Step3({ wishlistId }: { wishlistId: string }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [linkLoading, setLinkLoading] = useState(true);
  const [copyLabel, setCopyLabel] = useState('Kopiera länk');
  const [error, setError] = useState<string | null>(null);

  const inviteUrl = token
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${token}`
    : null;

  useEffect(() => {
    async function fetchOrCreateInvite() {
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) return;
        const res = await fetch('/api/invite/create-for-child', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken, wishlistId }),
        });
        if (res.ok) {
          const data = await res.json();
          setToken(data.token);
        } else {
          setError('Kunde inte hämta delningslänk.');
        }
      } catch {
        setError('Något gick fel. Försök igen.');
      } finally {
        setLinkLoading(false);
      }
    }
    fetchOrCreateInvite();
  }, [wishlistId]);

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
    <div className="flex flex-col gap-4">
      <p className="text-sm text-[#6B7280]">
        Skicka länken till familj och vänner så kan de se önskelistan.
      </p>
      {error && <p role="alert" className="text-[#DC2626] text-sm">{error}</p>}
      {linkLoading ? (
        <p className="text-sm text-[#6B7280]">Laddar…</p>
      ) : token ? (
        <div className="flex gap-2 items-center flex-wrap">
          <input
            type="text"
            readOnly
            value={inviteUrl ?? ''}
            aria-label="Delningslänk"
            className="flex-1 min-w-0 border border-[#E5D5CC] rounded-md px-3 py-2 text-sm text-[#171717] bg-white font-mono"
          />
          <button
            onClick={handleCopy}
            className="bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-xl px-4 py-2 font-semibold text-sm min-h-[44px] transition-colors flex-shrink-0"
            aria-live="polite"
          >
            {copyLabel}
          </button>
        </div>
      ) : null}
      <button
        onClick={() => router.push(`/viewer/${wishlistId}`)}
        className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-xl px-4 py-2 font-semibold min-h-[44px] transition-colors"
      >
        Gå till önskelistan
      </button>
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user, role, loading } = useAuth();
  const [state, setState] = useState<WizardState>({ step: 1, wishlistId: null });

  // Auth gate — viewer only (D-03)
  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && role === 'child') router.push('/wishlist');
  }, [loading, user, role, router]);

  const headings: Record<1 | 2 | 3, string> = {
    1: 'Skapa barnkonto',
    2: 'Namnge önskelistan',
    3: 'Dela önskelistan',
  };

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FFF9F5]">
        <p className="text-[#6B7280]">Laddar…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4 bg-[#FFF9F5]">
      <div className="w-full max-w-sm">
        <p className="text-sm text-center text-[#6B7280] mb-2">Kom igång</p>
        <h1 className="text-2xl font-bold mb-4 text-center text-[#171717]">
          {headings[state.step]}
        </h1>
        <StepDots step={state.step} />

        {state.step === 1 && (
          <ChildAccountForm
            onSuccess={(uid) =>
              setState({ step: 2, wishlistId: uid })
            }
          />
        )}
        {state.step === 2 && state.wishlistId && (
          <Step2
            wishlistId={state.wishlistId}
            onDone={() => setState((s) => ({ ...s, step: 3 }))}
          />
        )}
        {state.step === 3 && state.wishlistId && (
          <Step3 wishlistId={state.wishlistId} />
        )}
      </div>
    </main>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase/client';
import { useAuth } from '@/components/AuthProvider';
import { ChildAccountForm } from '@/components/onboarding/ChildAccountForm';
import { LightShell } from '@/components/galaxy';

type WizardState = {
  step: 1 | 2 | 3;
  wishlistId: string | null;
};

function StepDots({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="flex justify-center gap-2 mb-6" aria-label={`Steg ${step} av 3`}>
      {([1, 2, 3] as const).map((n) => (
        <span
          key={n}
          aria-current={n === step ? 'step' : undefined}
          className="h-1.5 w-7 rounded-full"
          style={{
            background:
              n === step
                ? 'linear-gradient(90deg, #FF7AB8, #B28BFF)'
                : 'var(--color-border-light)',
            boxShadow: n === step ? '0 0 8px rgba(255,122,184,0.45)' : undefined,
          }}
        />
      ))}
    </div>
  );
}

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
        <label
          htmlFor="wishlistTitle"
          className="block mb-1.5 text-[10px] font-bold tracking-caps"
          style={{ color: 'var(--color-muted-light)' }}
        >
          Namn på önskelistan
        </label>
        <input
          id="wishlistTitle"
          type="text"
          placeholder="t.ex. Elsas önskelista"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="light-input"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm font-semibold" style={{ color: 'var(--color-destructive)' }}>
          {error}
        </p>
      )}
      <button type="submit" disabled={loading} className="light-cta mt-1">
        {loading ? 'Sparar…' : 'Spara och fortsätt'}
      </button>
    </form>
  );
}

function Step3({ wishlistId }: { wishlistId: string }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [linkLoading, setLinkLoading] = useState(true);
  const [copyLabel, setCopyLabel] = useState('Kopiera');
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
      setTimeout(() => setCopyLabel('Kopiera'), 2000);
    } catch {
      setError('Kunde inte kopiera länken.');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[14px]" style={{ color: 'var(--color-muted-light)' }}>
        Skicka länken till familj och vänner så kan de se önskelistan.
      </p>
      {error && (
        <p role="alert" className="text-sm font-semibold" style={{ color: 'var(--color-destructive)' }}>
          {error}
        </p>
      )}
      {linkLoading ? (
        <p className="text-sm" style={{ color: 'var(--color-muted-light)' }}>
          Laddar…
        </p>
      ) : token ? (
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2"
          style={{ background: 'var(--color-accent-soft)' }}
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
            className="text-[12px] font-bold px-2 py-1.5 rounded-md"
            style={{ color: 'var(--color-accent)' }}
          >
            {copyLabel}
          </button>
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => router.push(`/viewer/${wishlistId}`)}
        className="light-cta"
      >
        Gå till önskelistan →
      </button>
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user, role, loading } = useAuth();
  const [state, setState] = useState<WizardState>({ step: 1, wishlistId: null });

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && role === 'child') router.push('/wishlist');
  }, [loading, user, role, router]);

  const headings: Record<1 | 2 | 3, string> = {
    1: 'Tänd en ny stjärna',
    2: 'Namnge önskelistan',
    3: 'Dela önskelistan',
  };

  const subtitles: Record<1 | 2 | 3, string> = {
    1: 'Skapa eget konto åt ditt barn',
    2: 'Vad ska listan heta?',
    3: 'Bjud in mormor, farfar och vänner',
  };

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
      <div className="app-page app-top">
        <StepDots step={state.step} />
      </div>
      <div className="app-page text-center">
        <p className="text-[11px] font-bold tracking-caps" style={{ color: 'var(--color-muted-light)' }}>
          Steg {state.step} av 3
        </p>
        <h1 className="font-display font-bold text-[28px] mt-1.5 gradient-text-warm leading-tight">
          {headings[state.step]}
        </h1>
        <p className="mt-2 text-[14px]" style={{ color: 'var(--color-muted-light)' }}>
          {subtitles[state.step]}
        </p>
      </div>

      <div className="flex-1 app-page app-bottom pt-6">
        <div className="mx-auto w-full max-w-sm">
          {state.step === 1 && (
            <ChildAccountForm
              onSuccess={(uid) => setState({ step: 2, wishlistId: uid })}
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
      </div>
    </LightShell>
  );
}

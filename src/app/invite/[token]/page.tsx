'use client';
import { use, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { useAuth } from '@/components/AuthProvider';
import { Molly, NightShell, Sparkle } from '@/components/galaxy';

type PageState = 'loading' | 'invalid' | 'logged-out' | 'joining' | 'error';

function InlineAuthForm({
  mode,
  onSuccess,
  onSwitchMode,
}: {
  mode: 'login' | 'register';
  onSuccess: () => void;
  onSwitchMode: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        const idToken = await credential.user.getIdToken();
        await fetch('/api/auth/set-viewer-claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });
        await credential.user.getIdToken(/* forceRefresh = */ true);
      }
      onSuccess();
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      setError(
        code === 'auth/invalid-credential' ||
          code === 'auth/wrong-password' ||
          code === 'auth/user-not-found'
          ? 'Fel e-post eller lösenord.'
          : code === 'auth/email-already-in-use'
          ? 'Det finns redan ett konto med den e-postadressen.'
          : 'Något gick fel. Försök igen.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
      <div>
        <label
          htmlFor="email"
          className="block mb-1.5 text-[10px] font-bold tracking-caps"
          style={{ color: 'var(--color-muted)' }}
        >
          E-post
        </label>
        <input
          id="email"
          type="email"
          required
          aria-required="true"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="night-input"
        />
      </div>
      <div>
        <label
          htmlFor="password"
          className="block mb-1.5 text-[10px] font-bold tracking-caps"
          style={{ color: 'var(--color-muted)' }}
        >
          Lösenord
        </label>
        <input
          id="password"
          type="password"
          required
          aria-required="true"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="night-input"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm font-semibold" style={{ color: 'var(--color-pink)' }}>
          {error}
        </p>
      )}
      <button type="submit" disabled={saving} className="neon-cta mt-1">
        {saving
          ? 'Laddar…'
          : mode === 'login'
          ? 'Logga in och gå med'
          : 'Skapa konto och gå med'}
      </button>
      <button
        type="button"
        onClick={onSwitchMode}
        className="text-[13px] mt-1"
        style={{ color: 'var(--color-cyan)' }}
      >
        {mode === 'login'
          ? 'Inget konto? Skapa ett här'
          : 'Har du redan ett konto? Logga in'}
      </button>
    </form>
  );
}

export default function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const { user, loading, refreshRole } = useAuth();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const initialAuthCheckedRef = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (initialAuthCheckedRef.current) return;
    initialAuthCheckedRef.current = true;

    if (user) {
      setPageState('joining');
      redeemToken();
    } else {
      setPageState('logged-out');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  async function redeemToken() {
    try {
      const idToken = await user!.getIdToken();
      const res = await fetch('/api/invite/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, token }),
      });

      if (res.status === 404 || res.status === 410) {
        setPageState('invalid');
        return;
      }

      if (!res.ok) {
        setPageState('error');
        return;
      }

      const data = await res.json();

      if (data.alreadyViewer) {
        router.push(`/viewer/${data.wishlistId}`);
        return;
      }

      await auth.currentUser?.getIdToken(/* forceRefresh = */ true);
      await refreshRole();
      router.push(`/viewer/${data.wishlistId}`);
    } catch {
      setPageState('error');
    }
  }

  function handleAuthSuccess() {
    setPageState('joining');
    redeemToken();
  }

  if (pageState === 'loading' || loading || pageState === 'joining') {
    return (
      <NightShell twinkleCount={20}>
        <div className="flex-1 flex items-center justify-center">
          <p style={{ color: 'var(--color-muted)' }}>Laddar…</p>
        </div>
      </NightShell>
    );
  }

  if (pageState === 'invalid') {
    return (
      <NightShell twinkleCount={20}>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 app-page text-center">
          <Molly size={80} mood="sleepy" eyeColor="#0F1330" blushColor="#FF7AB8" />
          <h1 className="font-display text-[24px] font-bold gradient-text">
            Länken är inte längre giltig
          </h1>
          <p role="alert" className="text-[14px] max-w-sm" style={{ color: 'var(--color-muted)' }}>
            Be den som skickade länken att skapa en ny delningslänk.
          </p>
        </div>
      </NightShell>
    );
  }

  if (pageState === 'error') {
    return (
      <NightShell twinkleCount={20}>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 app-page text-center">
          <Molly size={80} mood="thinking" eyeColor="#0F1330" blushColor="#FF7AB8" />
          <h1 className="font-display text-[24px] font-bold gradient-text">Något gick fel</h1>
          <p role="alert" className="text-[14px] max-w-sm" style={{ color: 'var(--color-muted)' }}>
            Kunde inte gå med i önskelistan. Försök igen om en stund.
          </p>
          <button
            type="button"
            onClick={() => {
              setPageState('joining');
              redeemToken();
            }}
            className="neon-cta-outline"
          >
            Försök igen
          </button>
        </div>
      </NightShell>
    );
  }

  return (
    <NightShell dense twinkleCount={28} auroraColor="#B28BFF" auroraTop={120} auroraRight="50%">
      <div className="flex-1 flex flex-col items-center app-page app-bottom" style={{ paddingTop: 'max(48px, calc(env(safe-area-inset-top) + 32px))' }}>
        <div className="relative anim-molly mb-4">
          <div
            aria-hidden="true"
            className="absolute -inset-3 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(125,227,255,0.55) 0%, transparent 70%)',
              filter: 'blur(12px)',
            }}
          />
          <Molly size={80} mood="excited" eyeColor="#0F1330" blushColor="#FF7AB8" style={{ position: 'relative' }} />
        </div>
        <h1 className="font-display font-bold text-[26px] gradient-text text-center leading-tight">
          Du har bjudits in
          <br />till en önskelista
        </h1>
        <p className="mt-3 text-[13px] text-center max-w-xs" style={{ color: 'var(--color-muted)' }}>
          Logga in eller skapa ett konto för att se listan och koordinera inköp utan att förstöra överraskningen.
        </p>

        <div className="w-full max-w-sm mt-7 night-card p-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkle size={14} color="#FFD36E" />
            <h2 className="font-display font-semibold text-[16px]">
              {authMode === 'login' ? 'Logga in' : 'Skapa konto'}
            </h2>
          </div>
          <InlineAuthForm
            mode={authMode}
            onSuccess={handleAuthSuccess}
            onSwitchMode={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
          />
        </div>
      </div>
    </NightShell>
  );
}

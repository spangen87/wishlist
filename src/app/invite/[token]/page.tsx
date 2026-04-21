'use client';
import { use, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { useAuth } from '@/components/AuthProvider';

type PageState =
  | 'loading'
  | 'invalid'
  | 'logged-out'
  | 'joining'
  | 'error';

// Minimal inline auth form — login or register, toggled by mode prop
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
        // Set viewer claim for new account
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
      // Firebase v9+ uses err.code (e.g. "auth/invalid-credential") not err.message substrings.
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <div>
        <label htmlFor="email" className="text-sm text-[#6B7280]">E-postadress</label>
        <input
          id="email"
          type="email"
          required
          aria-required="true"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mt-1 border border-[#E5D5CC] rounded-md px-3 py-2 text-base text-[#171717] bg-white"
        />
      </div>
      <div>
        <label htmlFor="password" className="text-sm text-[#6B7280]">Lösenord</label>
        <input
          id="password"
          type="password"
          required
          aria-required="true"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mt-1 border border-[#E5D5CC] rounded-md px-3 py-2 text-base text-[#171717] bg-white"
        />
      </div>
      {error && <p role="alert" className="text-[#DC2626] text-sm">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="bg-[#F97316] hover:bg-[#EA6C0A] text-white rounded-xl px-4 py-3 font-semibold min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {saving
          ? 'Laddar\u2026'
          : mode === 'login'
          ? 'Logga in och g\u00e5 med'
          : 'Skapa konto och g\u00e5 med'}
      </button>
      <button
        type="button"
        onClick={onSwitchMode}
        className="text-sm text-[#6B7280] hover:underline"
      >
        {mode === 'login'
          ? 'Inget konto? Skapa ett h\u00e4r'
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
  // Guard: only let useEffect trigger redeemToken on the initial auth state resolution.
  // If auth happens via the inline form (login or register), handleAuthSuccess calls
  // redeemToken explicitly instead — preventing a race where onIdTokenChanged fires
  // mid-form and triggers redemption before set-viewer-claim has completed.
  const initialAuthCheckedRef = useRef(false);

  // After auth state resolves, determine what to show
  useEffect(() => {
    if (loading) return;
    if (initialAuthCheckedRef.current) return;
    initialAuthCheckedRef.current = true;

    if (user) {
      // User was already logged in when the page loaded — attempt redemption immediately
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
        // Already a viewer — redirect immediately (no token refresh needed)
        router.push(`/viewer/${data.wishlistId}`);
        return;
      }

      // Force-refresh token so new claim is available to Firestore rules, then
      // sync the updated role into AuthProvider context via refreshRole().
      await auth.currentUser?.getIdToken(/* forceRefresh = */ true);
      await refreshRole();
      router.push(`/viewer/${data.wishlistId}`);
    } catch {
      setPageState('error');
    }
  }

  function handleAuthSuccess() {
    // Called after the inline form completes login or registration (including set-viewer-claim).
    // We drive redemption explicitly here instead of relying on useEffect, which is guarded
    // to only run once on initial load to avoid a race with set-viewer-claim.
    setPageState('joining');
    redeemToken();
  }

  if (pageState === 'loading' || loading || pageState === 'joining') {
    return (
      <main className="min-h-screen bg-[#FFF9F5] flex items-center justify-center">
        <p className="text-[#6B7280]">Laddar\u2026</p>
      </main>
    );
  }

  if (pageState === 'invalid') {
    return (
      <main className="min-h-screen bg-[#FFF9F5] flex flex-col items-center justify-center gap-4 px-4 py-16">
        <h1 className="text-[28px] font-semibold text-[#171717] text-center leading-[1.2]">
          L\u00e4nken \u00e4r inte l\u00e4ngre giltig
        </h1>
        <p role="alert" className="text-base text-[#6B7280] text-center max-w-sm">
          Be den som skickade l\u00e4nken att skapa en ny delningsl\u00e4nk.
        </p>
      </main>
    );
  }

  if (pageState === 'error') {
    return (
      <main className="min-h-screen bg-[#FFF9F5] flex flex-col items-center justify-center gap-4 px-4 py-16">
        <h1 className="text-[28px] font-semibold text-[#171717] text-center leading-[1.2]">
          N\u00e5got gick fel
        </h1>
        <p role="alert" className="text-base text-[#6B7280] text-center max-w-sm">
          Kunde inte g\u00e5 med i \u00f6nskelistan. F\u00f6rs\u00f6k igen om en stund.
        </p>
        <button
          onClick={() => { setPageState('joining'); redeemToken(); }}
          className="text-[#F97316] hover:underline text-sm min-h-[44px]"
        >
          F\u00f6rs\u00f6k igen
        </button>
      </main>
    );
  }

  // logged-out state — show welcoming join page with inline auth
  return (
    <main className="min-h-screen bg-[#FFF9F5] flex flex-col items-center justify-center gap-8 px-4 py-16">
      <div className="text-center max-w-md">
        <h1 className="text-[28px] font-semibold text-[#171717] leading-[1.2]">
          Du har bjudits in till en \u00f6nskelista
        </h1>
        <p className="mt-4 text-base text-[#6B7280]">
          Skapa ett konto eller logga in f\u00f6r att koordinera ink\u00f6p utan att f\u00f6rst\u00f6ra \u00f6verraskingen.
        </p>
      </div>

      <div className="w-full max-w-sm bg-[#FFF0E8] border border-[#E5D5CC] rounded-2xl shadow-sm p-6">
        <InlineAuthForm
          mode={authMode}
          onSuccess={handleAuthSuccess}
          onSwitchMode={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
        />
      </div>
    </main>
  );
}

'use client';
import { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase/client';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Step 1: Create Firebase Auth account
      const credential = await createUserWithEmailAndPassword(auth, email, password);

      // Step 2: Get ID token to prove identity to the server
      const idToken = await credential.user.getIdToken();

      // Step 3: Set viewer custom claim via Route Handler
      const response = await fetch('/api/auth/set-viewer-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        setError('Registreringen misslyckades, försök igen');
        return;
      }

      // Step 4: Force token refresh so role claim is available immediately (Pitfall 1)
      // Without this, getIdTokenResult() would return a cached token without the 'viewer' claim.
      await credential.user.getIdToken(/* forceRefresh = */ true);

      router.push('/onboarding');
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/email-already-in-use') {
        setError('Det finns redan ett konto med den e-postadressen');
      } else if (code === 'auth/weak-password') {
        setError('Lösenordet måste vara minst 6 tecken');
      } else {
        setError('Registreringen misslyckades, försök igen');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4 bg-[#FFF9F5]">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-6 text-center">Skapa konto</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              E-post
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-[#E5D5CC] rounded px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1">
              Lösenord
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-[#E5D5CC] rounded px-3 py-2"
            />
          </div>
          {error && (
            <p role="alert" className="text-[#DC2626] text-sm">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-xl px-4 py-2 font-semibold min-h-[44px] transition-colors disabled:opacity-50"
          >
            {loading ? 'Skapar…' : 'Skapa konto'}
          </button>
        </form>
        <p className="mt-4 text-sm text-center">
          Har du redan ett konto?{' '}
          <a href="/login" className="underline" style={{ color: 'var(--color-accent)' }}>
            Logga in
          </a>
        </p>
      </div>
    </main>
  );
}

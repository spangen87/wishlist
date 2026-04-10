'use client';
import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase/client';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const input = username.trim();
      let email: string;

      if (input.includes('@')) {
        // Viewer flow: direct email login
        email = input;
      } else {
        // Child flow: username → synthetic email via usernames lookup
        const usernameLower = input.toLowerCase();
        const usernameRef = doc(db, 'usernames', usernameLower);
        const snap = await getDoc(usernameRef);

        if (!snap.exists()) {
          setError('Användarnamn eller lösenord är felaktigt');
          return;
        }

        email = `${usernameLower}@wishlist.internal`;
      }

      const result = await signInWithEmailAndPassword(auth, email, password);
      const idTokenResult = await result.user.getIdTokenResult();
      const role = idTokenResult.claims['role'] as string | undefined;
      router.push(role === 'child' ? '/wishlist' : '/dashboard');
    } catch {
      setError('Användarnamn eller lösenord är felaktigt');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-6 text-center">Logga in</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium mb-1">
              Användarnamn eller e-post
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1">
              Lösenord
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          {error && (
            <p role="alert" className="text-red-600 text-sm">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-xl px-4 py-2 font-semibold min-h-[44px] transition-colors disabled:opacity-50"
          >
            {loading ? 'Loggar in…' : 'Logga in'}
          </button>
        </form>
        <p className="mt-4 text-sm text-center">
          Inte ett barnkonto?{' '}
          <a href="/register" className="underline" style={{ color: 'var(--color-accent)' }}>
            Registrera dig som betraktare
          </a>
        </p>
      </div>
    </main>
  );
}

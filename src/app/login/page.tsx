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
      const usernameLower = username.trim().toLowerCase();

      // Look up username — verify it exists (doc only stores { uid })
      const usernameRef = doc(db, 'usernames', usernameLower);
      const snap = await getDoc(usernameRef);

      if (!snap.exists()) {
        // Do not reveal whether username or password was wrong (anti-enumeration)
        setError('Username or password incorrect');
        return;
      }

      // Derive synthetic email — never stored in the usernames doc
      const syntheticEmail = `${usernameLower}@wishlist.internal`;
      await signInWithEmailAndPassword(auth, syntheticEmail, password);

      router.push('/dashboard');
    } catch {
      // Firebase auth errors and Firestore errors both surface here
      setError('Username or password incorrect');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-6 text-center">Log in</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium mb-1">
              Username
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
              Password
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
            className="bg-blue-600 text-white rounded px-4 py-2 font-medium disabled:opacity-50"
          >
            {loading ? 'Logging in\u2026' : 'Log in'}
          </button>
        </form>
        <p className="mt-4 text-sm text-center">
          Not a child account?{' '}
          <a href="/register" className="text-blue-600 underline">
            Register as a viewer
          </a>
        </p>
      </div>
    </main>
  );
}

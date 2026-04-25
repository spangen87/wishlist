'use client';
import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { auth, db } from '@/lib/firebase/client';
import { Molly, NightShell } from '@/components/galaxy';

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
        email = input;
      } else {
        const usernameLower = input.toLowerCase();
        const usernameRef = doc(db, 'usernames', usernameLower);
        const snap = await getDoc(usernameRef);

        if (!snap.exists()) {
          setError('Det finns inget barnkonto med det användarnamnet.');
          return;
        }

        email = `${usernameLower}@wishlist.internal`;
      }

      const result = await signInWithEmailAndPassword(auth, email, password);
      const idTokenResult = await result.user.getIdTokenResult();
      const role = idTokenResult.claims['role'] as string | undefined;
      router.push(role === 'child' ? '/wishlist' : '/dashboard');
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      if (
        code === 'auth/wrong-password' ||
        code === 'auth/invalid-credential'
      ) {
        setError('Fel lösenord. Be en förälder återställa det om det glömts bort.');
      } else if (code === 'auth/user-not-found') {
        setError('Det finns inget konto med de uppgifterna.');
      } else if (code === 'auth/too-many-requests') {
        setError('För många misslyckade försök. Vänta en stund innan du försöker igen.');
      } else if (code === 'auth/network-request-failed') {
        setError('Nätverksfel. Kontrollera anslutningen och försök igen.');
      } else if (code === 'auth/user-disabled') {
        setError('Kontot är inaktiverat.');
      } else {
        setError('Inloggningen misslyckades. Försök igen.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <NightShell dense twinkleCount={32} auroraColor="#B28BFF" auroraTop={140} auroraRight="50%">
      <div className="flex flex-col items-center pt-16 pb-8 px-6 relative">
        <div className="relative anim-molly">
          <div
            aria-hidden="true"
            className="absolute -inset-3 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(125,227,255,0.6) 0%, transparent 70%)',
              filter: 'blur(12px)',
            }}
          />
          <Molly size={88} mood="happy" eyeColor="#0F1330" blushColor="#FF7AB8" style={{ position: 'relative' }} />
        </div>
        <h1 className="font-display font-bold text-[34px] mt-4 gradient-text leading-none">
          Önskestjärnan
        </h1>
        <p className="mt-2 text-[12px] tracking-caps font-semibold" style={{ color: 'var(--color-muted)' }}>
          Önska på en stjärna
        </p>
      </div>

      <div className="flex-1 px-6 pb-10">
        <div className="mx-auto w-full max-w-sm">
          <form
            onSubmit={handleSubmit}
            className="night-card p-6 flex flex-col gap-4"
            style={{ boxShadow: '0 0 32px rgba(178, 139, 255, 0.15), 0 8px 24px rgba(0,0,0,0.3)' }}
          >
            <h2 className="font-display font-semibold text-[20px]" style={{ color: 'var(--color-ink)' }}>
              Logga in
            </h2>

            <div>
              <label
                htmlFor="username"
                className="block mb-1.5 text-[10px] font-bold tracking-caps"
                style={{ color: 'var(--color-muted)' }}
              >
                Användarnamn / e-post
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
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
                autoComplete="current-password"
                required
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

            <button type="submit" disabled={loading} className="neon-cta mt-1">
              {loading ? 'Loggar in…' : 'Logga in'}
            </button>

            <p className="text-center text-[13px] mt-1" style={{ color: 'var(--color-muted)' }}>
              Vuxen?{' '}
              <Link href="/register" className="font-bold" style={{ color: 'var(--color-cyan)' }}>
                Registrera dig
              </Link>
            </p>
          </form>
        </div>
      </div>
    </NightShell>
  );
}

'use client';
import { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/firebase/client';
import { Molly, NightShell } from '@/components/galaxy';

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
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const idToken = await credential.user.getIdToken();

      const response = await fetch('/api/auth/set-parent-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        await credential.user.delete().catch(() => {});
        setError('Registreringen misslyckades, försök igen');
        return;
      }

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
    <NightShell dense twinkleCount={28} auroraColor="#FF7AB8" auroraTop={120} auroraRight="50%">
      <div className="flex flex-col items-center pt-14 pb-6 px-6 relative">
        <div className="relative anim-molly">
          <div
            aria-hidden="true"
            className="absolute -inset-3 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(178,139,255,0.55) 0%, transparent 70%)',
              filter: 'blur(12px)',
            }}
          />
          <Molly size={72} mood="thinking" eyeColor="#0F1330" blushColor="#FF7AB8" style={{ position: 'relative' }} />
        </div>
        <h1 className="font-display font-bold text-[28px] mt-4 gradient-text leading-none">
          Skapa konto
        </h1>
        <p className="mt-2 text-[12px] tracking-caps" style={{ color: 'var(--color-muted)' }}>
          För dig som vuxen
        </p>
      </div>

      <div className="flex-1 px-6 pb-10">
        <div className="mx-auto w-full max-w-sm">
          <form onSubmit={handleSubmit} className="night-card p-6 flex flex-col gap-4">
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
                autoComplete="email"
                required
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
                autoComplete="new-password"
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
              {loading ? 'Skapar…' : 'Skapa konto'}
            </button>

            <p className="text-center text-[13px] mt-1" style={{ color: 'var(--color-muted)' }}>
              Har du redan ett konto?{' '}
              <Link href="/login" className="font-bold" style={{ color: 'var(--color-cyan)' }}>
                Logga in
              </Link>
            </p>
          </form>
        </div>
      </div>
    </NightShell>
  );
}

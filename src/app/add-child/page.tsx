'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { ChildAccountForm } from '@/components/onboarding/ChildAccountForm';
import { LightShell, ArrowLeft } from '@/components/galaxy';

export default function AddChildPage() {
  const router = useRouter();
  const { user, role, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && role === 'child') router.push('/wishlist');
  }, [loading, user, role, router]);

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
      <header
        className="flex items-center gap-3 app-page app-top pb-4"
        style={{ borderBottom: '1px solid var(--color-border-light)', background: '#fff' }}
      >
        <Link
          href="/dashboard"
          aria-label="Tillbaka till mina listor"
          className="flex items-center justify-center min-h-[44px] min-w-[44px]"
          style={{ color: 'var(--color-muted-light)' }}
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className="font-display font-bold text-[20px]">Lägg till barn</h1>
      </header>

      <div className="flex-1 app-page app-bottom pt-8">
        <div className="mx-auto w-full max-w-sm">
          <p className="mb-6 text-[14px]" style={{ color: 'var(--color-muted-light)' }}>
            Skapa eget konto åt ditt barn. Barnet kan logga in själv och hantera sin önskelista.
          </p>
          <ChildAccountForm onSuccess={() => router.push('/dashboard')} />
        </div>
      </div>
    </LightShell>
  );
}

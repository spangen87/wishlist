'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { ChildAccountForm } from '@/components/onboarding/ChildAccountForm';

export default function AddChildPage() {
  const router = useRouter();
  const { user, role, loading } = useAuth();

  // Auth gate — viewer only (same as /onboarding)
  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && role === 'child') router.push('/wishlist');
  }, [loading, user, role, router]);

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
        <h1 className="text-2xl font-bold mb-6 text-center text-[#171717]">
          Lägg till barn
        </h1>
        <ChildAccountForm
          onSuccess={() => router.push('/dashboard')}
        />
        <p className="mt-4 text-sm text-center">
          <a
            href="/dashboard"
            className="text-[#6B7280] underline"
          >
            Tillbaka till instrumentpanelen
          </a>
        </p>
      </div>
    </main>
  );
}

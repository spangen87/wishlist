'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { useAuth } from '@/components/AuthProvider';
import { auth } from '@/lib/firebase/client';

export default function DashboardPage() {
  const router = useRouter();
  const { user, role, loading } = useAuth();

  // Redirect to login if not authenticated (real auth gate — not proxy)
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  // Prevent auth flash: show nothing while Firebase rehydrates from IndexedDB
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p>Loading…</p>
      </main>
    );
  }

  // After loading resolves, if no user the useEffect redirect fires
  if (!user) return null;

  async function handleLogout() {
    await signOut(auth);
    router.push('/login');
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Logged in as <span className="font-medium">{user.email}</span>
        </p>
        {role && (
          <p className="text-sm text-gray-500">Role: {role}</p>
        )}
      </div>
      <button
        onClick={handleLogout}
        className="bg-red-600 text-white rounded px-6 py-2 font-medium hover:bg-red-700"
      >
        Log out
      </button>
    </main>
  );
}

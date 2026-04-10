'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

export default function Home() {
  const router = useRouter();
  const { user, role, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
    } else if (role === 'child') {
      router.replace('/wishlist');
    } else {
      router.replace('/dashboard');
    }
  }, [loading, user, role, router]);

  return null;
}

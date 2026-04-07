'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

/**
 * Real-time listener proof-of-concept route (D-14).
 *
 * Purpose: Verify that Firestore onSnapshot listeners work correctly in Next.js
 * client components. This route is infrastructure verification only — it will
 * be removed or repurposed in a later phase.
 *
 * To test real-time updates:
 * 1. Start Firestore emulator: npm run emulator
 * 2. Run dev server: npm run dev
 * 3. Visit http://localhost:3000/test
 * 4. Use emulator UI at http://localhost:4000 to update the document
 * 5. Verify the page updates without a browser refresh
 */

interface TestWishlistData {
  title?: string;
  lastUpdated?: string;
  [key: string]: unknown;
}

const TEST_WISHLIST_ID = 'test-wishlist-id';

export default function TestPage() {
  const [data, setData] = useState<TestWishlistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const docRef = doc(db, 'wishlists', TEST_WISHLIST_ID);

    // Attach real-time listener.
    // onSnapshot returns an unsubscribe function — store it for cleanup.
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setData(snapshot.data() as TestWishlistData);
        } else {
          setData(null);
        }
        setLoading(false);
      },
      (err) => {
        // onSnapshot error handler — catches permission denied errors and network failures
        setError(err.message);
        setLoading(false);
      }
    );

    // Cleanup: detach listener when component unmounts.
    // Without this, listeners accumulate and Firestore connections are never closed.
    return () => unsubscribe();
  }, []);

  const handleSeedDocument = async () => {
    // Seed the test document so there is something to listen to.
    // This uses the client SDK — requires Firestore emulator running and rules permitting.
    try {
      await setDoc(doc(db, 'wishlists', TEST_WISHLIST_ID), {
        title: 'Test Wishlist',
        lastUpdated: new Date().toISOString(),
      });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div style={{ fontFamily: 'monospace', padding: '2rem' }}>
      <h1>Firestore Real-time Listener Test</h1>
      <p style={{ color: '#666', fontSize: '0.875rem' }}>
        This page tests Firestore onSnapshot real-time updates (D-14 / SYNC-01).
        It is not part of the app — it will be removed in a later phase.
      </p>

      <hr />

      {loading && <p>Connecting to Firestore...</p>}
      {error && (
        <p style={{ color: 'red' }}>
          Error: {error}
          <br />
          <small>
            Is the Firestore emulator running? Run <code>npm run emulator</code>
          </small>
        </p>
      )}

      {!loading && !error && (
        <>
          {data ? (
            <div>
              <p style={{ color: 'green' }}>Live data (updates without refresh):</p>
              <pre style={{ background: '#f4f4f4', padding: '1rem' }}>
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
          ) : (
            <div>
              <p>
                Document <code>wishlists/{TEST_WISHLIST_ID}</code> does not exist yet.
              </p>
              <button onClick={handleSeedDocument} style={{ marginTop: '0.5rem' }}>
                Seed test document
              </button>
            </div>
          )}
        </>
      )}

      <hr />
      <p style={{ fontSize: '0.75rem', color: '#999' }}>
        To verify real-time: update the document in the Firestore emulator UI at{' '}
        <a href="http://localhost:4000">http://localhost:4000</a> and watch this
        page update without a browser refresh.
      </p>
    </div>
  );
}

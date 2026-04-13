/**
 * Purge orphaned Firestore data for users deleted from Firebase Auth.
 *
 * Problem: When a user is manually deleted from Firebase Auth Console,
 * their Firestore documents (users/{uid}, usernames/{username}, wishlists/{uid})
 * are NOT automatically removed. This script finds and removes them.
 *
 * Usage (against emulator):
 *   npm run emulator   # start emulators first
 *   npx tsx scripts/purge-orphans.ts
 *
 * Usage (against production — USE WITH CAUTION):
 *   # Set GOOGLE_APPLICATION_CREDENTIALS env var to service account JSON
 *   # Remove the EMULATOR env vars below
 *   npx tsx scripts/purge-orphans.ts
 */

// Point Admin SDK to emulators — remove these lines to run against production
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_PROJECT_ID = 'wishlist-dev';

import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const app =
  getApps().length === 0
    ? initializeApp({ projectId: 'wishlist-dev' })
    : getApps()[0];

const adminAuth = getAuth(app);
const adminDb = getFirestore(app);

async function syncParentUids(): Promise<number> {
  // Phase A: sync parentUids from wishlists/{childUid} → users/{childUid}
  // This populates a fallback field so DELETE /api/auth/user/[uid] can still
  // authorize parent-initiated child account deletion when the wishlist is gone.
  console.log('Phase A: syncing parentUids from wishlists → user docs...\n');
  const wishlistsSnap = await adminDb.collection('wishlists').get();
  let synced = 0;
  const syncBatch = adminDb.batch();
  for (const wDoc of wishlistsSnap.docs) {
    const parentUids: string[] = wDoc.data().parentUids ?? [];
    if (parentUids.length > 0) {
      syncBatch.set(
        adminDb.collection('users').doc(wDoc.id),
        { parentUids },
        { merge: true }
      );
      synced++;
    }
  }
  if (synced > 0) await syncBatch.commit();
  console.log(`  ✓ synced parentUids for ${synced} child user doc(s)\n`);
  return synced;
}

async function purgeOrphans(): Promise<void> {
  const syncCount = await syncParentUids();

  console.log('Phase B: scanning users/ collection for orphaned Firestore data...\n');

  const usersSnap = await adminDb.collection('users').get();
  console.log(`Found ${usersSnap.size} user document(s) in Firestore.\n`);

  let orphansFound = 0;
  let orphansDeleted = 0;
  let errors = 0;

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const userData = userDoc.data();
    const role: string = userData.role ?? 'viewer';
    const username: string | undefined = userData.username;

    // Check if user still exists in Firebase Auth
    let authUserExists = true;
    try {
      await adminAuth.getUser(uid);
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'auth/user-not-found') {
        authUserExists = false;
      } else {
        // Unexpected error — log and skip
        console.error(`  ERROR checking uid ${uid}:`, err);
        errors++;
        continue;
      }
    }

    if (authUserExists) {
      // User is still in Auth — skip
      continue;
    }

    orphansFound++;
    console.log(`ORPHAN uid=${uid} role=${role}${username ? ` username=${username}` : ''}`);

    try {
      if (role === 'child') {
        // 1. Cascade-delete wishlist + items/* + purchaseStatus/* + activityLog/*
        const wishlistRef = adminDb.collection('wishlists').doc(uid);
        const wishlistSnap = await wishlistRef.get();
        if (wishlistSnap.exists) {
          await adminDb.recursiveDelete(wishlistRef);
          console.log(`  ✓ deleted wishlists/${uid} (recursive)`);
        }

        // 2. Batch-delete users/{uid} and usernames/{username}
        const batch = adminDb.batch();
        batch.delete(adminDb.collection('users').doc(uid));
        if (username) {
          batch.delete(adminDb.collection('usernames').doc(username));
        }
        await batch.commit();
        console.log(`  ✓ deleted users/${uid}${username ? ` + usernames/${username}` : ''}`);

        // 3. Clean up orphaned invite tokens for this wishlist
        const inviteSnap = await adminDb.collection('invites')
          .where('wishlistId', '==', uid).get();
        if (!inviteSnap.empty) {
          const inviteBatch = adminDb.batch();
          inviteSnap.docs.forEach((d) => inviteBatch.delete(d.ref));
          await inviteBatch.commit();
          console.log(`  ✓ deleted ${inviteSnap.size} invite token(s) for wishlist ${uid}`);
        }
      } else {
        // parent or viewer: remove UID from all wishlist arrays + delete user doc
        const [parentLists, viewerLists] = await Promise.all([
          adminDb.collection('wishlists').where('parentUids', 'array-contains', uid).get(),
          adminDb.collection('wishlists').where('viewerUids', 'array-contains', uid).get(),
        ]);

        const removalBatch = adminDb.batch();
        parentLists.docs.forEach((d) =>
          removalBatch.update(d.ref, { parentUids: FieldValue.arrayRemove(uid) })
        );
        viewerLists.docs.forEach((d) =>
          removalBatch.update(d.ref, { viewerUids: FieldValue.arrayRemove(uid) })
        );
        removalBatch.delete(adminDb.collection('users').doc(uid));
        await removalBatch.commit();

        const listCount = parentLists.size + viewerLists.size;
        console.log(`  ✓ removed uid from ${listCount} wishlist array(s), deleted users/${uid}`);
      }

      orphansDeleted++;
    } catch (err) {
      console.error(`  ERROR cleaning orphan uid=${uid}:`, err);
      errors++;
    }
  }

  console.log('\n── Summary ──────────────────────────────────');
  console.log(`parentUids synced (Phase A)   : ${syncCount}`);
  console.log(`Total Firestore users scanned : ${usersSnap.size}`);
  console.log(`Orphans found                 : ${orphansFound}`);
  console.log(`Orphans cleaned               : ${orphansDeleted}`);
  console.log(`Errors                        : ${errors}`);
  if (errors > 0) {
    console.log('\nSome orphans could not be cleaned — review errors above.');
    process.exit(1);
  }
}

purgeOrphans().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

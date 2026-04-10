/**
 * Seed the Firebase local emulator with test data.
 *
 * Usage:
 *   npm run seed
 *
 * Requires the emulator to be running first:
 *   npm run emulator
 *
 * Seeds:
 *   Child account  — username: barn    / password: test123
 *   Viewer account — username: viewer  / password: test123
 *   Wishlist with 3 sample items, viewer linked
 */

// Point Admin SDK to emulators (must be set before initializeApp)
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_PROJECT_ID = 'wishlist-dev';

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const app =
  getApps().length === 0
    ? initializeApp({ projectId: 'wishlist-dev' })
    : getApps()[0];

const adminAuth = getAuth(app);
const adminDb = getFirestore(app);

// ── helpers ───────────────────────────────────────────────────────────────────

async function createChildUser(username: string, password: string) {
  const usernameLower = username.toLowerCase().trim();
  const syntheticEmail = `${usernameLower}@wishlist.internal`;

  // Delete if exists so the script is idempotent
  try {
    const existing = await adminAuth.getUserByEmail(syntheticEmail);
    await adminAuth.deleteUser(existing.uid);
    console.log(`  ↺ deleted existing auth user for "${usernameLower}"`);
  } catch {
    // Not found — fine
  }

  const userRecord = await adminAuth.createUser({
    email: syntheticEmail,
    password,
    displayName: usernameLower,
  });

  await adminAuth.setCustomUserClaims(userRecord.uid, { role: 'child' });

  const batch = adminDb.batch();
  batch.set(adminDb.collection('usernames').doc(usernameLower), {
    uid: userRecord.uid,
  });
  batch.set(adminDb.collection('users').doc(userRecord.uid), {
    uid: userRecord.uid,
    username: usernameLower,
    email: syntheticEmail,
    role: 'child',
    createdAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();

  console.log(`  ✓ child user "${usernameLower}" created (uid: ${userRecord.uid})`);
  return userRecord.uid;
}

async function createViewerUser(email: string, password: string) {
  try {
    const existing = await adminAuth.getUserByEmail(email);
    await adminAuth.deleteUser(existing.uid);
    console.log(`  ↺ deleted existing auth user for "${email}"`);
  } catch {
    // Not found — fine
  }

  const userRecord = await adminAuth.createUser({ email, password });
  await adminAuth.setCustomUserClaims(userRecord.uid, { role: 'viewer' });

  await adminDb.collection('users').doc(userRecord.uid).set({
    uid: userRecord.uid,
    email,
    role: 'viewer',
    createdAt: FieldValue.serverTimestamp(),
  });

  console.log(`  ✓ viewer user "${email}" created (uid: ${userRecord.uid})`);
  return userRecord.uid;
}

async function createWishlist(
  childUid: string,
  viewerUids: string[],
  items: { title: string; note?: string; price?: number }[],
) {
  const wishlistRef = adminDb.collection('wishlists').doc();
  const wishlistId = wishlistRef.id;

  await wishlistRef.set({
    id: wishlistId,
    childUid,
    viewerUids,
    createdAt: FieldValue.serverTimestamp(),
  });

  // Add items with simple fractional positions
  const batch = adminDb.batch();
  items.forEach((item, i) => {
    const itemRef = wishlistRef.collection('items').doc();
    batch.set(itemRef, {
      id: itemRef.id,
      title: item.title,
      ...(item.note ? { note: item.note } : {}),
      ...(item.price !== undefined ? { price: item.price } : {}),
      position: String(i + 1),
      createdAt: FieldValue.serverTimestamp(),
    });
  });
  await batch.commit();

  console.log(`  ✓ wishlist created (id: ${wishlistId}) with ${items.length} items`);
  return wishlistId;
}

// ── main ──────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('\n🌱 Seeding Firebase emulator...\n');

  console.log('Creating child account...');
  const childUid = await createChildUser('barn', 'test123');

  console.log('\nCreating viewer account...');
  const viewerUid = await createViewerUser('viewer@test.dev', 'test123');

  console.log('\nCreating wishlist...');
  const wishlistId = await createWishlist(
    childUid,
    [viewerUid],
    [
      { title: 'LEGO Technic 42196', price: 899 },
      { title: 'Minecraft på PS5', note: 'Helst digital version', price: 449 },
      { title: 'Hörlurar (trådlösa)', price: 600 },
    ],
  );

  // Link viewer to wishlist in viewer's profile
  await adminDb
    .collection('users')
    .doc(viewerUid)
    .update({ viewedWishlists: [wishlistId] });

  console.log('\n─────────────────────────────────────────');
  console.log('✅ Seed complete!\n');
  console.log('  Child login:   username=barn          password=test123');
  console.log('  Viewer login:  username=viewer@test.dev  password=test123');
  console.log('  Emulator UI:   http://127.0.0.1:4000');
  console.log('─────────────────────────────────────────\n');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

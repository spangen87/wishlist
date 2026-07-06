import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

describe('Firestore Security Rules — Privacy Boundary', () => {
  let testEnv: RulesTestEnvironment;

  const CHILD_UID = 'child-uid-123';
  const VIEWER_UID = 'viewer-uid-456';
  const WISHLIST_ID = 'wishlist-test-1';
  const ITEM_ID = 'item-test-1';
  const ACTIVITY_LOG_ID = 'activity-test-1';

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'wishlist-test',
      firestore: {
        rules: fs.readFileSync(
          path.join(__dirname, '..', 'firestore.rules'),
          'utf8'
        ),
        host: '127.0.0.1',
        port: 8080,
      },
    });
  });

  beforeEach(async () => {
    // Seed test data without rules (simulates Admin SDK writes)
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();

      // Create wishlist document with child as owner and viewer in viewerUids
      await setDoc(doc(db, 'wishlists', WISHLIST_ID), {
        childUid: CHILD_UID,
        viewerUids: [VIEWER_UID],
        createdAt: new Date(),
      });

      // Create an item in the items subcollection
      await setDoc(doc(db, 'wishlists', WISHLIST_ID, 'items', ITEM_ID), {
        id: ITEM_ID,
        title: 'Test Item',
        position: '0',
        createdAt: new Date(),
      });

      // Create a purchase status document
      await setDoc(
        doc(db, 'wishlists', WISHLIST_ID, 'purchaseStatus', ITEM_ID),
        {
          itemId: ITEM_ID,
          viewerUids: [VIEWER_UID],
          purchasedBy: VIEWER_UID,
        }
      );

      // Create an activity log document
      await setDoc(
        doc(db, 'wishlists', WISHLIST_ID, 'activityLog', ACTIVITY_LOG_ID),
        {
          id: ACTIVITY_LOG_ID,
          viewerUid: VIEWER_UID,
          action: 'marked_purchased',
          itemId: ITEM_ID,
          timestamp: new Date(),
        }
      );
    });
  });

  afterEach(async () => {
    await testEnv.clearFirestore();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  // === CRITICAL: purchaseStatus privacy boundary ===

  it('DENY: child UID cannot read purchaseStatus subcollection', async () => {
    const childCtx = testEnv.authenticatedContext(CHILD_UID);
    const statusRef = doc(
      childCtx.firestore(),
      'wishlists',
      WISHLIST_ID,
      'purchaseStatus',
      ITEM_ID
    );
    // This MUST fail — child has no access to purchaseStatus regardless of ownership
    await assertFails(getDoc(statusRef));
  });

  it('DENY: child UID cannot write to purchaseStatus subcollection', async () => {
    const childCtx = testEnv.authenticatedContext(CHILD_UID);
    const statusRef = doc(
      childCtx.firestore(),
      'wishlists',
      WISHLIST_ID,
      'purchaseStatus',
      ITEM_ID
    );
    await assertFails(
      setDoc(statusRef, { itemId: ITEM_ID, viewerUids: [VIEWER_UID] })
    );
  });

  it('ALLOW: viewer UID can read purchaseStatus subcollection', async () => {
    const viewerCtx = testEnv.authenticatedContext(VIEWER_UID);
    const statusRef = doc(
      viewerCtx.firestore(),
      'wishlists',
      WISHLIST_ID,
      'purchaseStatus',
      ITEM_ID
    );
    await assertSucceeds(getDoc(statusRef));
  });

  it('ALLOW: viewer UID can write to purchaseStatus subcollection', async () => {
    const viewerCtx = testEnv.authenticatedContext(VIEWER_UID);
    const statusRef = doc(
      viewerCtx.firestore(),
      'wishlists',
      WISHLIST_ID,
      'purchaseStatus',
      ITEM_ID
    );
    await assertSucceeds(
      setDoc(statusRef, {
        itemId: ITEM_ID,
        viewerUids: [VIEWER_UID],
        purchasedBy: VIEWER_UID,
      })
    );
  });

  it('DENY: unauthenticated user cannot read purchaseStatus', async () => {
    const unauthCtx = testEnv.unauthenticatedContext();
    const statusRef = doc(
      unauthCtx.firestore(),
      'wishlists',
      WISHLIST_ID,
      'purchaseStatus',
      ITEM_ID
    );
    await assertFails(getDoc(statusRef));
  });

  // === Items subcollection ===

  it('ALLOW: child UID can read items subcollection', async () => {
    const childCtx = testEnv.authenticatedContext(CHILD_UID);
    const itemRef = doc(
      childCtx.firestore(),
      'wishlists',
      WISHLIST_ID,
      'items',
      ITEM_ID
    );
    await assertSucceeds(getDoc(itemRef));
  });

  it('ALLOW: viewer UID can read items subcollection', async () => {
    const viewerCtx = testEnv.authenticatedContext(VIEWER_UID);
    const itemRef = doc(
      viewerCtx.firestore(),
      'wishlists',
      WISHLIST_ID,
      'items',
      ITEM_ID
    );
    await assertSucceeds(getDoc(itemRef));
  });

  it('DENY: viewer UID cannot write to items subcollection', async () => {
    const viewerCtx = testEnv.authenticatedContext(VIEWER_UID);
    const itemRef = doc(
      viewerCtx.firestore(),
      'wishlists',
      WISHLIST_ID,
      'items',
      'new-item'
    );
    await assertFails(
      setDoc(itemRef, { id: 'new-item', title: 'Hacked item', position: '0', createdAt: new Date() })
    );
  });

  // === photoData validation on items (own photos stored inline) ===

  const VALID_PHOTO = 'data:image/jpeg;base64,' + 'A'.repeat(1000);

  it('ALLOW: child can create item with a valid JPEG photoData', async () => {
    const childCtx = testEnv.authenticatedContext(CHILD_UID);
    const itemRef = doc(childCtx.firestore(), 'wishlists', WISHLIST_ID, 'items', 'photo-item');
    await assertSucceeds(
      setDoc(itemRef, { title: 'Foto', position: '1', createdAt: new Date(), photoData: VALID_PHOTO })
    );
  });

  it('ALLOW: child can update an item with a valid JPEG photoData', async () => {
    const childCtx = testEnv.authenticatedContext(CHILD_UID);
    const itemRef = doc(childCtx.firestore(), 'wishlists', WISHLIST_ID, 'items', ITEM_ID);
    await assertSucceeds(setDoc(itemRef, { photoData: VALID_PHOTO }, { merge: true }));
  });

  it('DENY: photoData over the 300000 char size cap', async () => {
    const childCtx = testEnv.authenticatedContext(CHILD_UID);
    const itemRef = doc(childCtx.firestore(), 'wishlists', WISHLIST_ID, 'items', 'big-photo');
    const oversized = 'data:image/jpeg;base64,' + 'A'.repeat(300001);
    await assertFails(
      setDoc(itemRef, { title: 'För stor', position: '1', createdAt: new Date(), photoData: oversized })
    );
  });

  it('DENY: photoData that is not a JPEG data URL', async () => {
    const childCtx = testEnv.authenticatedContext(CHILD_UID);
    const itemRef = doc(childCtx.firestore(), 'wishlists', WISHLIST_ID, 'items', 'evil-photo');
    await assertFails(
      setDoc(itemRef, {
        title: 'Fel typ',
        position: '1',
        createdAt: new Date(),
        photoData: 'data:text/html;base64,PGh0bWw+',
      })
    );
  });

  it('DENY: photoData that is not a string', async () => {
    const childCtx = testEnv.authenticatedContext(CHILD_UID);
    const itemRef = doc(childCtx.firestore(), 'wishlists', WISHLIST_ID, 'items', 'num-photo');
    await assertFails(
      setDoc(itemRef, { title: 'Fel typ', position: '1', createdAt: new Date(), photoData: 12345 })
    );
  });

  // === invites collection — Admin SDK only ===

  it('DENY: authenticated user cannot read invites collection', async () => {
    const viewerCtx = testEnv.authenticatedContext(VIEWER_UID);
    const inviteRef = doc(viewerCtx.firestore(), 'invites', 'some-token');
    await assertFails(getDoc(inviteRef));
  });

  // === activityLog subcollection — viewer read only, Admin SDK writes ===

  it('DENY: child UID cannot read activityLog', async () => {
    const childCtx = testEnv.authenticatedContext(CHILD_UID);
    const db = childCtx.firestore();
    await assertFails(
      getDoc(doc(db, 'wishlists', WISHLIST_ID, 'activityLog', ACTIVITY_LOG_ID))
    );
  });

  it('DENY: child UID cannot write to activityLog', async () => {
    const childCtx = testEnv.authenticatedContext(CHILD_UID);
    const db = childCtx.firestore();
    await assertFails(
      setDoc(doc(db, 'wishlists', WISHLIST_ID, 'activityLog', 'new-entry'), {
        id: 'new-entry',
        viewerUid: CHILD_UID,
        action: 'test',
        timestamp: new Date(),
      })
    );
  });

  it('ALLOW: viewer UID can read activityLog', async () => {
    const viewerCtx = testEnv.authenticatedContext(VIEWER_UID);
    const db = viewerCtx.firestore();
    await assertSucceeds(
      getDoc(doc(db, 'wishlists', WISHLIST_ID, 'activityLog', ACTIVITY_LOG_ID))
    );
  });

  it('DENY: viewer UID cannot write to activityLog (write: if false)', async () => {
    const viewerCtx = testEnv.authenticatedContext(VIEWER_UID);
    const db = viewerCtx.firestore();
    await assertFails(
      setDoc(doc(db, 'wishlists', WISHLIST_ID, 'activityLog', 'new-entry'), {
        id: 'new-entry',
        viewerUid: VIEWER_UID,
        action: 'test',
        timestamp: new Date(),
      })
    );
  });
});

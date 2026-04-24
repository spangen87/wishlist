import { Timestamp } from 'firebase/firestore';

// wishlists/{wishlistId}
export interface WishlistDoc {
  id: string;
  childUid: string;       // UID of the child who owns this wishlist
  viewerUids: string[];   // UIDs of viewers who have been granted access
  parentUids: string[];   // UIDs of users with parent-level admin access (D-04)
  createdAt: Timestamp;
  title?: string;         // Optional: parent-given wishlist name (e.g. "Elsas önskelista")
  currentInviteToken?: string;          // Active share link token for viewer invites
  currentParentInviteToken?: string;    // Active share link token for parent invites (D-11)
  occasion?: {
    name: string;   // e.g. "Födelsedag"
    date: string;   // ISO 8601 date string, e.g. "2026-05-15"
  };
}

// wishlists/{wishlistId}/items/{itemId}
export interface WishItemDoc {
  id: string;
  title: string;           // Required
  productUrl?: string;     // Optional: link to product
  imageUrl?: string;       // Optional: image URL
  note?: string;           // Optional: child's personal note
  price?: number;          // Optional: approximate price
  position: string;        // Fractional index for drag-and-drop ordering (Phase 3)
  createdAt: Timestamp;
}

// wishlists/{wishlistId}/purchaseStatus/{itemId}
// PRIVACY BOUNDARY: Child UID cannot read this subcollection (enforced by Firestore rules)
export interface PurchaseStatusDoc {
  itemId: string;
  viewerUids: string[];       // Copied from parent wishlist for rule evaluation
  purchasedBy?: string;       // UID of viewer who marked as purchased
  purchasedAt?: Timestamp;
  viewerNotes?: Record<string, string>; // Map of viewerUid → note text (D-12, D-15)
}

// wishlists/{wishlistId}/activityLog/{entryId}
// PRIVACY BOUNDARY: Written server-side only via API routes (Admin SDK batch)
// Viewers can read; child cannot read (enforced in firestore.rules)
export interface ActivityLogDoc {
  viewerUid: string;                                          // UID of the viewer who acted
  action: 'marked_purchased' | 'unmarked_purchased' | 'added_note';
  itemId: string;
  itemTitle: string;
  timestamp: Timestamp;
}

// users/{uid}
export interface UserDoc {
  uid: string;
  username?: string;    // Set for child accounts; undefined for viewer accounts
  email: string;        // Real email for viewers; synthetic email for children
  role: 'child' | 'viewer' | 'parent';
  createdAt: Timestamp;
  displayName?: string; // Optional: human-readable child name shown in dashboard (e.g. "Elsa")
  age?: number;         // Optional: stored for future use; no UI in v1.1
}

// usernames/{username}
export interface UsernameDoc {
  uid: string;  // Maps username → child UID for login
}

// invites/{token}
export interface InviteDoc {
  wishlistId: string;
  token: string;
  createdAt: Timestamp;
  active: boolean;  // Set to false to revoke share link (SHARE-03)
  type: 'parent' | 'viewer';  // D-11: distinguishes parent vs viewer invite
}

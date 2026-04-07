import { Timestamp } from 'firebase/firestore';

// wishlists/{wishlistId}
export interface WishlistDoc {
  id: string;
  childUid: string;       // UID of the child who owns this wishlist
  viewerUids: string[];   // UIDs of viewers who have been granted access
  createdAt: Timestamp;
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
  viewerNote?: string;        // Viewer note (not visible to child)
}

// users/{uid}
export interface UserDoc {
  uid: string;
  username?: string;    // Set for child accounts; undefined for viewer accounts
  email: string;        // Real email for viewers; synthetic email for children
  role: 'child' | 'viewer' | 'parent';
  createdAt: Timestamp;
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
}

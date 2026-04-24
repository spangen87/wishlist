'use client';
import { useState } from 'react';
import { PurchasedBadge } from '@/components/viewer/PurchasedBadge';
import { ViewerNoteField } from '@/components/viewer/ViewerNoteField';
import { OtherViewerNotes } from '@/components/viewer/OtherViewerNotes';
import type { WishItemDoc, PurchaseStatusDoc } from '@/types/firestore';

function isSafeUrl(url: string): boolean {
  return url.startsWith('https://') || url.startsWith('http://');
}

interface ViewerWishItemCardProps {
  item: WishItemDoc;
  wishlistId: string;
  status: PurchaseStatusDoc | undefined;   // undefined = no purchaseStatus doc exists
  currentUid: string;
  // Callbacks — parent fetches idToken and calls API
  onTogglePurchased: (itemId: string, itemTitle: string, purchased: boolean) => Promise<void>;
  onUpdateNote: (itemId: string, itemTitle: string, note: string) => Promise<void>;
  onToggleReserved: (itemId: string, itemTitle: string, reserve: boolean) => Promise<void>;
  purchaserName?: string; // resolved display name for status.purchasedBy uid (pre-fetched by parent)
  reserverName?: string;  // resolved display name for status.reservedBy (pre-fetched by parent)
  otherViewerNotes: Array<{ uid: string; displayName: string; note: string }>;
}

export function ViewerWishItemCard({
  item,
  status,
  currentUid,
  onTogglePurchased,
  onUpdateNote,
  onToggleReserved,
  purchaserName,
  reserverName,
  otherViewerNotes,
}: ViewerWishItemCardProps) {
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [reserving, setReserving] = useState(false);
  const [reserveError, setReserveError] = useState<string | null>(null);

  const isPurchased = !!status?.purchasedBy;
  const isOwnPurchase = status?.purchasedBy === currentUid;
  const isOthersPurchase = isPurchased && !isOwnPurchase;

  const isReserved = !!status?.reservedBy;
  const isOwnReservation = status?.reservedBy === currentUid;
  const isOtherReservation = isReserved && !isOwnReservation;

  async function handleToggle() {
    if (isOthersPurchase) return; // disabled
    setToggling(true);
    setToggleError(null);
    try {
      await onTogglePurchased(item.id, item.title, !isPurchased);
    } catch {
      setToggleError('Något gick fel. Försök igen.');
    } finally {
      setToggling(false);
    }
  }

  async function handleToggleReserve() {
    if (isOtherReservation) return;
    setReserving(true);
    setReserveError(null);
    try {
      await onToggleReserved(item.id, item.title, !isOwnReservation);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('409') || msg.includes('Already reserved')) {
        setReserveError('Någon annan har redan reserverat detta.');
      } else {
        setReserveError('Något gick fel. Försök igen.');
      }
    } finally {
      setReserving(false);
    }
  }

  return (
    <li
      role="listitem"
      className={`bg-[#FFF0E8] border border-[#E5D5CC] rounded-2xl shadow-sm hover:shadow-md transition-shadow p-4 flex gap-3 items-start`}
    >
      {/* Content area */}
      <div className="flex-1 min-w-0">
        {/* Title — struck through if purchased */}
        <h2
          className={`text-xl font-semibold leading-tight ${
            isPurchased ? 'line-through text-[#6B7280]' : 'text-[#171717]'
          }`}
        >
          {item.title}
        </h2>

        {item.price !== undefined && (
          <span className="text-sm text-[#6B7280]">~{item.price} kr</span>
        )}

        {item.productUrl && isSafeUrl(item.productUrl) && (
          <a
            href={item.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[#6B7280] truncate block max-w-full hover:underline"
          >
            {item.productUrl}
          </a>
        )}

        {/* Purchase status badge */}
        {isPurchased && purchaserName && (
          <PurchasedBadge purchaserName={purchaserName} isCurrentUser={isOwnPurchase} />
        )}

        {/* Reservation badge — shown only when someone else has reserved (D-10) */}
        {isOtherReservation && reserverName && (
          <span className="text-sm text-[#6B7280] italic">
            Reserverad av {reserverName}
          </span>
        )}

        {/* Reserve button — hidden when item is purchased (D-14) */}
        {!isPurchased && (
          <button
            onClick={handleToggleReserve}
            disabled={reserving || isOtherReservation}
            aria-label={
              isOtherReservation
                ? `Reserverad av ${reserverName ?? '...'}`
                : isOwnReservation
                ? `Avboka reservation för ${item.title}`
                : `Reservera ${item.title}`
            }
            className={`mt-3 flex items-center gap-2 rounded-xl px-4 py-2 font-semibold text-sm min-h-[44px] transition-colors border ${
              isOtherReservation
                ? 'opacity-50 cursor-not-allowed border-[#E5D5CC] bg-white text-[#6B7280]'
                : isOwnReservation
                ? 'bg-[#F97316] hover:bg-[#EA6C0A] border-[#F97316] text-white'
                : 'border-dashed border-[#E5D5CC] bg-white hover:bg-[#FFF0E8] text-[#171717]'
            } disabled:opacity-50`}
          >
            {isOtherReservation
              ? `Reserverad av ${reserverName ?? '...'}`
              : isOwnReservation
              ? 'Du tänker köpa detta'
              : 'Jag tänker köpa detta'}
          </button>
        )}
        {reserveError && (
          <p role="alert" className="text-[#DC2626] text-sm mt-1">{reserveError}</p>
        )}

        {/* Purchase toggle */}
        <button
          onClick={handleToggle}
          disabled={toggling || isOthersPurchase}
          aria-label={
            isPurchased ? `Avmarkera ${item.title}` : `Markera ${item.title} som köpt`
          }
          className={`mt-3 flex items-center gap-2 rounded-xl px-4 py-2 font-semibold text-sm min-h-[44px] transition-colors border ${
            isOthersPurchase
              ? 'opacity-50 cursor-not-allowed border-[#E5D5CC] bg-white text-[#6B7280]'
              : isPurchased
              ? 'bg-[#F97316] hover:bg-[#EA6C0A] border-[#F97316] text-white'
              : 'bg-white hover:bg-[#FFF0E8] border-[#E5D5CC] text-[#171717]'
          } disabled:opacity-50`}
        >
          {isPurchased ? (
            <>
              {/* Checkmark SVG */}
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M13.5 3.5L6 11 2.5 7.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {isOwnPurchase ? 'Markerad som köpt av dig' : `Köpt av ${purchaserName ?? '...'}`}
            </>
          ) : (
            'Markera som köpt'
          )}
        </button>

        {toggleError && (
          <p role="alert" className="text-[#DC2626] text-sm mt-1">{toggleError}</p>
        )}

        {/* Viewer note section (D-13, D-14) */}
        <div className="mt-3">
          <ViewerNoteField
            itemId={item.id}
            itemTitle={item.title}
            currentNote={status?.viewerNotes?.[currentUid] ?? ''}
            onSave={(note) => onUpdateNote(item.id, item.title, note)}
          />
          <OtherViewerNotes notes={otherViewerNotes} />
        </div>
      </div>

      {/* Right column: thumbnail */}
      <div className="flex-shrink-0">
        {item.imageUrl && !imageLoadError ? (
          <img
            src={item.imageUrl}
            alt={item.title}
            width={64}
            height={64}
            className="w-16 h-16 rounded-md object-cover"
            onError={() => setImageLoadError(true)}
          />
        ) : (
          <div className="w-16 h-16 rounded-md bg-[#E5D5CC]" aria-hidden="true" />
        )}
      </div>
    </li>
  );
}

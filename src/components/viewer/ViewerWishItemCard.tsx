'use client';
import { useState } from 'react';
import { PurchasedBadge } from '@/components/viewer/PurchasedBadge';
import { ViewerNoteField } from '@/components/viewer/ViewerNoteField';
import { OtherViewerNotes } from '@/components/viewer/OtherViewerNotes';
import { Check } from '@/components/galaxy';
import { isSafeUrl } from '@/lib/url';
import type { WishItemDoc, PurchaseStatusDoc } from '@/types/firestore';

interface ViewerWishItemCardProps {
  item: WishItemDoc;
  wishlistId: string;
  status: PurchaseStatusDoc | undefined;
  currentUid: string;
  onTogglePurchased: (itemId: string, itemTitle: string, purchased: boolean) => Promise<void>;
  onUpdateNote: (itemId: string, itemTitle: string, note: string) => Promise<void>;
  onToggleReserved: (itemId: string, itemTitle: string, reserve: boolean) => Promise<void>;
  purchaserName?: string;
  reserverName?: string;
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
    if (isOthersPurchase) return;
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
      className="light-card flex gap-3 p-3"
      style={{ opacity: isPurchased ? 0.7 : 1 }}
    >
      {/* Thumbnail */}
      <div className="shrink-0">
        {item.imageUrl && !imageLoadError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.title}
            width={56}
            height={56}
            className="object-cover"
            style={{ width: 56, height: 56, borderRadius: 12, background: 'var(--color-bg-light)' }}
            onError={() => setImageLoadError(true)}
          />
        ) : (
          <div
            aria-hidden="true"
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: 'var(--color-accent-soft)',
            }}
          />
        )}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <h2
            className={`font-display font-semibold text-[15px] leading-tight flex-1 ${
              isPurchased ? 'line-through' : ''
            }`}
            style={{ color: 'var(--color-ink-light)' }}
          >
            {item.title}
          </h2>

          {/* Checkbox toggle */}
          <button
            type="button"
            onClick={handleToggle}
            disabled={toggling || isOthersPurchase}
            aria-label={
              isPurchased ? `Avmarkera ${item.title}` : `Markera ${item.title} som köpt`
            }
            className="shrink-0 flex items-center justify-center disabled:opacity-50"
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: isPurchased ? 'var(--color-accent)' : 'transparent',
              border: `1.5px solid ${
                isPurchased ? 'var(--color-accent)' : 'var(--color-border-light)'
              }`,
            }}
          >
            {isPurchased && <Check size={14} color="#fff" />}
          </button>
        </div>

        <div className="mt-1 flex items-center gap-2 flex-wrap text-[12px]">
          {item.price !== undefined && (
            <span className="font-tabular" style={{ color: 'var(--color-muted-light)' }}>
              ~{item.price} kr
            </span>
          )}
          {isPurchased && purchaserName && (
            <PurchasedBadge purchaserName={purchaserName} isCurrentUser={isOwnPurchase} />
          )}
          {isOtherReservation && reserverName && (
            <span className="italic" style={{ color: 'var(--color-muted-light)' }}>
              · Reserverad av {reserverName}
            </span>
          )}
        </div>

        {item.productUrl && isSafeUrl(item.productUrl) && (
          <a
            href={item.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block mt-1 text-[11px] font-mono truncate hover:underline"
            style={{ color: 'var(--color-muted-light)' }}
          >
            {item.productUrl}
          </a>
        )}

        {/* Reserve / actions */}
        <div className="mt-3 flex flex-col gap-2">
          {!isPurchased && (
            <button
              type="button"
              onClick={handleToggleReserve}
              disabled={reserving || isOtherReservation}
              aria-label={
                isOtherReservation
                  ? `Reserverad av ${reserverName ?? '...'}`
                  : isOwnReservation
                  ? `Avboka reservation för ${item.title}`
                  : `Reservera ${item.title}`
              }
              className="rounded-full text-[12px] font-bold px-3.5 py-2 self-start disabled:opacity-50"
              style={{
                background: isOwnReservation ? 'var(--color-accent-soft)' : 'transparent',
                color: isOwnReservation ? 'var(--color-accent)' : 'var(--color-muted-light)',
                border: `1px ${
                  isOwnReservation ? 'solid' : 'dashed'
                } var(--color-border-light)`,
                cursor: isOtherReservation ? 'not-allowed' : 'pointer',
              }}
            >
              {isOtherReservation
                ? `Reserverad av ${reserverName ?? '...'}`
                : isOwnReservation
                ? '✓ Du tänker köpa'
                : 'Jag tänker köpa'}
            </button>
          )}

          {reserveError && (
            <p role="alert" className="text-[12px]" style={{ color: 'var(--color-destructive)' }}>
              {reserveError}
            </p>
          )}
          {toggleError && (
            <p role="alert" className="text-[12px]" style={{ color: 'var(--color-destructive)' }}>
              {toggleError}
            </p>
          )}

          <div>
            <ViewerNoteField
              itemId={item.id}
              itemTitle={item.title}
              currentNote={status?.viewerNotes?.[currentUid] ?? ''}
              onSave={(note) => onUpdateNote(item.id, item.title, note)}
            />
            <OtherViewerNotes notes={otherViewerNotes} />
          </div>
        </div>
      </div>
    </li>
  );
}

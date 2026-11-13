'use client';
import { useState } from 'react';
import { ViewerNoteField } from '@/components/viewer/ViewerNoteField';
import { OtherViewerNotes } from '@/components/viewer/OtherViewerNotes';
import { Check, Pencil, Trash, Heart } from '@/components/galaxy';
import { isSafeUrl } from '@/lib/url';
import type { WishItemDoc, PurchaseStatusDoc } from '@/types/firestore';

interface ViewerWishItemCardProps {
  item: WishItemDoc;
  wishlistId: string;
  status: PurchaseStatusDoc | undefined;
  currentUid: string;
  /**
   * Surprise mode — this reader may not see who bought or reserved what, so the
   * whole coordination half of the card (checkbox, reservation, viewer notes)
   * is left out rather than rendered empty.
   */
  hidePurchaseInfo?: boolean;
  /** Provided when the reader may manage the list's wishes (its parents). */
  onEdit?: () => void;
  onDelete?: () => void;
  /** Throws an Error whose message is shown to the reader when the change is refused. */
  onToggleFavorite?: (favorite: boolean) => Promise<void>;
  onTogglePurchased: (itemId: string, itemTitle: string, purchased: boolean) => Promise<void>;
  onUpdateNote: (itemId: string, itemTitle: string, note: string) => Promise<void>;
  onToggleReserved: (itemId: string, itemTitle: string, reserve: boolean) => Promise<void>;
  purchaserName?: string;
  reserverName?: string;
  otherViewerNotes: Array<{ uid: string; displayName: string; note: string }>;
  /** Who can read the buyers' notes — shown under the note field. */
  noteHint: string;
}

export function ViewerWishItemCard({
  item,
  status,
  currentUid,
  hidePurchaseInfo = false,
  onEdit,
  onDelete,
  onToggleFavorite,
  onTogglePurchased,
  onUpdateNote,
  onToggleReserved,
  purchaserName,
  reserverName,
  otherViewerNotes,
  noteHint,
}: ViewerWishItemCardProps) {
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);
  // Remember WHICH image failed, not just that one did — otherwise a link
  // that is corrected afterwards stays hidden until the page is reloaded.
  const [failedImageSrc, setFailedImageSrc] = useState<string | null>(null);
  const imageSrc = item.photoData ?? item.imageUrl;
  const imageLoadError = !!imageSrc && failedImageSrc === imageSrc;
  const [reserving, setReserving] = useState(false);
  const [reserveError, setReserveError] = useState<string | null>(null);
  const [favoriting, setFavoriting] = useState(false);
  const [favoriteError, setFavoriteError] = useState<string | null>(null);

  const isPurchased = !hidePurchaseInfo && !!status?.purchasedBy;
  const isOwnPurchase = status?.purchasedBy === currentUid;
  const isOthersPurchase = isPurchased && !isOwnPurchase;

  const isReserved = !hidePurchaseInfo && !!status?.reservedBy;
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

  async function handleToggleFavorite() {
    if (!onToggleFavorite) return;
    setFavoriting(true);
    setFavoriteError(null);
    try {
      await onToggleFavorite(!item.isFavorite);
    } catch (err: unknown) {
      setFavoriteError(
        err instanceof Error && err.message ? err.message : 'Något gick fel. Försök igen.'
      );
    } finally {
      setFavoriting(false);
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
      {/* Thumbnail — own photo wins over external image URL */}
      <div className="shrink-0">
        {imageSrc && !imageLoadError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageSrc}
            alt={item.title}
            width={56}
            height={56}
            className="object-cover"
            style={{ width: 56, height: 56, borderRadius: 12, background: 'var(--color-bg-light)' }}
            // Many shops refuse images requested from another site when a
            // referrer is sent along (hotlink protection); without one they load.
            referrerPolicy="no-referrer"
            onError={() => setFailedImageSrc(imageSrc)}
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
        </div>

        {item.price !== undefined && (
          <p className="mt-1 text-[12px] font-tabular" style={{ color: 'var(--color-muted-light)' }}>
            ~{item.price} kr
          </p>
        )}

        {item.note && (
          <p
            className="mt-1 text-[12px] italic leading-snug"
            style={{ color: 'var(--color-muted-light)' }}
          >
            {item.note}
          </p>
        )}

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

        {/* Manage — only on lists the reader is responsible for */}
        {(onEdit || onDelete || onToggleFavorite) && (
          <div className="mt-2 flex items-center gap-x-3.5 flex-wrap">
            {onToggleFavorite && (
              <button
                type="button"
                onClick={handleToggleFavorite}
                disabled={favoriting}
                aria-pressed={!!item.isFavorite}
                aria-label={
                  item.isFavorite
                    ? `Ta bort ${item.title} från favoriter`
                    : `Markera ${item.title} som favorit`
                }
                className="flex items-center gap-1.5 text-[12px] font-bold min-h-[36px] disabled:opacity-50"
                style={{
                  color: item.isFavorite ? 'var(--color-accent)' : 'var(--color-muted-light)',
                }}
              >
                <Heart
                  size={13}
                  color={item.isFavorite ? 'var(--color-accent)' : 'var(--color-border-light)'}
                />{' '}
                Favorit
              </button>
            )}
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="flex items-center gap-1.5 text-[12px] font-bold min-h-[36px]"
                style={{ color: 'var(--color-muted-light)' }}
              >
                <Pencil size={12} color="var(--color-muted-light)" /> Ändra
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                aria-label={`Ta bort ${item.title}`}
                className="flex items-center gap-1.5 text-[12px] font-bold min-h-[36px]"
                style={{ color: 'var(--color-destructive)' }}
              >
                <Trash size={12} color="var(--color-destructive)" /> Ta bort
              </button>
            )}
          </div>
        )}
        {favoriteError && (
          <p role="alert" className="text-[12px]" style={{ color: 'var(--color-destructive)' }}>
            {favoriteError}
          </p>
        )}

        {/* Reserve / actions */}
        {!hidePurchaseInfo && (
        <div className="mt-3 flex flex-col gap-2">
          {/* One step at a time: free → "Jag tänker köpa" → "Markera som köpt".
              Each state shows only the action that leads on from it (and a way
              back), so the two steps can't be mistaken for each other. */}
          <div className="flex items-center gap-x-3 gap-y-1.5 flex-wrap">
            {isPurchased ? (
              isOwnPurchase ? (
                <>
                  <span className="viewer-chip viewer-chip-on">
                    <Check size={11} color="var(--color-accent)" /> Köpt av dig
                  </span>
                  <button
                    type="button"
                    onClick={handleToggle}
                    disabled={toggling}
                    aria-label={`Ångra att ${item.title} är köpt`}
                    className="viewer-undo"
                  >
                    Ångra
                  </button>
                </>
              ) : (
                <span className="viewer-chip">Köpt av {purchaserName ?? '…'}</span>
              )
            ) : isOwnReservation ? (
              <>
                <span className="viewer-chip viewer-chip-on">
                  <Check size={11} color="var(--color-accent)" /> Du tänker köpa
                </span>
                <button
                  type="button"
                  onClick={handleToggleReserve}
                  disabled={reserving || toggling}
                  aria-label={`Ångra att du tänker köpa ${item.title}`}
                  className="viewer-undo"
                >
                  Ångra
                </button>
                <button
                  type="button"
                  onClick={handleToggle}
                  disabled={toggling || reserving}
                  aria-label={`Markera ${item.title} som köpt`}
                  className="rounded-full text-[12px] font-bold px-3.5 py-2 disabled:opacity-50"
                  style={{ background: 'var(--color-accent)', color: '#fff' }}
                >
                  Markera som köpt
                </button>
              </>
            ) : isOtherReservation ? (
              <span className="viewer-chip">Reserverad av {reserverName ?? '…'}</span>
            ) : (
              <button
                type="button"
                onClick={handleToggleReserve}
                disabled={reserving}
                aria-label={`Jag tänker köpa ${item.title}`}
                className="rounded-full text-[12px] font-bold px-3.5 py-2 disabled:opacity-50"
                style={{
                  color: 'var(--color-accent)',
                  border: '1px dashed var(--color-accent)',
                }}
              >
                Jag tänker köpa
              </button>
            )}
          </div>

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
              hint={noteHint}
              onSave={(note) => onUpdateNote(item.id, item.title, note)}
            />
            <OtherViewerNotes notes={otherViewerNotes} />
          </div>
        </div>
        )}
      </div>
    </li>
  );
}

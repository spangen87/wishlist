'use client';
import { useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { updateWishItem, deleteWishItem } from '@/lib/firebase/wishlist';
import { normalizeUrl, isSafeUrl } from '@/lib/url';
import { fileToPhotoDataUrl, MAX_PHOTOS_PER_LIST } from '@/lib/image';
import type { WishItemDoc } from '@/types/firestore';
import { Star, Heart, GripDots, Pencil, Trash, Camera } from '@/components/galaxy';

const ACCENTS = ['#7DE3FF', '#FF7AB8', '#FFD36E', '#B28BFF', '#85F2CA'];

interface WishItemCardProps {
  item: WishItemDoc;
  wishlistId: string;
  totalFavorites: number;
  totalPhotos: number;
  index?: number;
}

export function WishItemCard({ item, wishlistId, totalFavorites, totalPhotos, index = 0 }: WishItemCardProps) {
  const accent = ACCENTS[index % ACCENTS.length];
  const [editMode, setEditMode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [favoriteError, setFavoriteError] = useState(false);

  const [editTitle, setEditTitle] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editProductUrl, setEditProductUrl] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editPhotoData, setEditPhotoData] = useState<string | null>(null);
  const [editPhotoBusy, setEditPhotoBusy] = useState(false);
  const [editPhotoError, setEditPhotoError] = useState<string | null>(null);
  const [editTitleError, setEditTitleError] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editSaveError, setEditSaveError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Photos count toward the per-list cap only when this item doesn't
  // already have one (replacing an existing photo is always allowed).
  const atPhotoLimit = !item.photoData && totalPhotos >= MAX_PHOTOS_PER_LIST;

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  function handleStartEdit() {
    setEditTitle(item.title);
    setEditPrice(item.price !== undefined ? String(item.price) : '');
    setEditProductUrl(item.productUrl ?? '');
    setEditImageUrl(item.imageUrl ?? '');
    setEditNote(item.note ?? '');
    setEditPhotoData(item.photoData ?? null);
    setEditPhotoError(null);
    setEditTitleError(false);
    setEditSaveError(null);
    setShowDeleteConfirm(false);
    setEditMode(true);
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setEditPhotoError(null);
    setEditPhotoBusy(true);
    try {
      setEditPhotoData(await fileToPhotoDataUrl(file));
    } catch {
      setEditPhotoError('Kunde inte läsa bilden. Prova ett annat foto.');
    } finally {
      setEditPhotoBusy(false);
    }
  }

  function handleCancelEdit() {
    setEditMode(false);
    setShowDeleteConfirm(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editTitle.trim()) {
      setEditTitleError(true);
      return;
    }
    setEditSaving(true);
    setEditSaveError(null);
    try {
      const trimmedProductUrl = normalizeUrl(editProductUrl) || undefined;
      const trimmedImageUrl = normalizeUrl(editImageUrl) || undefined;
      if (trimmedProductUrl && !isSafeUrl(trimmedProductUrl)) {
        setEditSaveError('Länken måste vara en webbadress (https://…)');
        setEditSaving(false);
        return;
      }
      if (trimmedImageUrl && !isSafeUrl(trimmedImageUrl)) {
        setEditSaveError('Bildlänken måste vara en webbadress (https://…)');
        setEditSaving(false);
        return;
      }
      const changes: Partial<Omit<WishItemDoc, 'id' | 'createdAt' | 'position'>> = {
        title: editTitle.trim(),
        productUrl: trimmedProductUrl,
        imageUrl: trimmedImageUrl,
        photoData: editPhotoData ?? undefined,
        note: editNote.trim() || undefined,
        price: editPrice !== '' ? Number(editPrice) : undefined,
      };
      await updateWishItem(wishlistId, item.id, changes);
      setEditMode(false);
      setShowDeleteConfirm(false);
    } catch {
      setEditSaveError('Något gick fel. Försök igen.');
    } finally {
      setEditSaving(false);
    }
  }

  async function handleConfirmDelete() {
    try {
      await deleteWishItem(wishlistId, item.id);
    } catch {
      setEditSaveError('Något gick fel. Försök igen.');
    }
  }

  async function handleToggleFavorite() {
    if (!item.isFavorite && totalFavorites >= 5) {
      setFavoriteError(true);
      setTimeout(() => setFavoriteError(false), 3000);
      return;
    }
    try {
      await updateWishItem(wishlistId, item.id, { isFavorite: !item.isFavorite });
    } catch {
      // silent
    }
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      role="listitem"
      className="night-card relative overflow-hidden"
    >
      {/* Glow stripe */}
      <span
        aria-hidden="true"
        className="absolute left-0 top-0 bottom-0"
        style={{ width: 3, background: accent, boxShadow: `0 0 12px ${accent}` }}
      />

      {editMode ? (
        <form onSubmit={handleSave} noValidate className="flex flex-col gap-3 p-4 pl-5">
          <div>
            <label
              htmlFor={`title-${item.id}`}
              className="block mb-1.5 text-[10px] font-bold tracking-caps"
              style={{ color: 'var(--color-muted)' }}
            >
              Titel
            </label>
            <input
              id={`title-${item.id}`}
              type="text"
              required
              autoFocus
              maxLength={200}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="night-input"
            />
            {editTitleError && (
              <p role="alert" className="text-[12px] mt-1" style={{ color: 'var(--color-pink)' }}>
                Titel krävs
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor={`price-${item.id}`}
              className="block mb-1.5 text-[10px] font-bold tracking-caps"
              style={{ color: 'var(--color-cyan)' }}
            >
              Pris (kr)
            </label>
            <input
              id={`price-${item.id}`}
              type="number"
              min="0"
              value={editPrice}
              onChange={(e) => setEditPrice(e.target.value)}
              className="night-input"
            />
          </div>
          <div>
            <label
              htmlFor={`productUrl-${item.id}`}
              className="block mb-1.5 text-[10px] font-bold tracking-caps"
              style={{ color: 'var(--color-gold)' }}
            >
              Länk
            </label>
            <input
              id={`productUrl-${item.id}`}
              type="url"
              value={editProductUrl}
              onChange={(e) => setEditProductUrl(e.target.value)}
              onBlur={(e) => setEditProductUrl(normalizeUrl(e.target.value))}
              className="night-input font-mono text-[12px]"
            />
          </div>
          <div>
            <label
              htmlFor={`imageUrl-${item.id}`}
              className="block mb-1.5 text-[10px] font-bold tracking-caps"
              style={{ color: 'var(--color-violet)' }}
            >
              Bildlänk
            </label>
            <input
              id={`imageUrl-${item.id}`}
              type="url"
              value={editImageUrl}
              onChange={(e) => setEditImageUrl(e.target.value)}
              onBlur={(e) => setEditImageUrl(normalizeUrl(e.target.value))}
              className="night-input font-mono text-[12px]"
            />
          </div>
          <div>
            <label
              className="block mb-1.5 text-[10px] font-bold tracking-caps"
              style={{ color: 'var(--color-gold)' }}
            >
              Eget foto
            </label>
            {editPhotoData ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={editPhotoData}
                  alt="Ditt foto"
                  className="object-cover"
                  style={{ width: 56, height: 56, borderRadius: 12 }}
                />
                <button
                  type="button"
                  onClick={() => setEditPhotoData(null)}
                  className="text-[13px] font-semibold"
                  style={{ color: 'var(--color-pink)' }}
                >
                  Ta bort foto
                </button>
              </div>
            ) : atPhotoLimit ? (
              <p className="text-[12px]" style={{ color: 'var(--color-muted)' }}>
                Listan har redan {MAX_PHOTOS_PER_LIST} foton (max). Ta bort ett
                foto från ett annat önskemål först.
              </p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={editPhotoBusy}
                  className="neon-cta-outline flex items-center gap-1.5"
                >
                  <Camera size={14} /> {editPhotoBusy ? 'Förbereder…' : 'Ta ett foto'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                  aria-label="Välj foto"
                />
              </>
            )}
            {editPhotoError && (
              <p role="alert" className="text-[12px] mt-1" style={{ color: 'var(--color-pink)' }}>
                {editPhotoError}
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor={`note-${item.id}`}
              className="block mb-1.5 text-[10px] font-bold tracking-caps"
              style={{ color: 'var(--color-mint)' }}
            >
              Anteckning
            </label>
            <textarea
              id={`note-${item.id}`}
              rows={3}
              maxLength={1000}
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              className="night-input italic resize-none"
              style={{ boxShadow: '0 0 16px rgba(133,242,202,0.18)' }}
            />
          </div>
          {editSaveError && (
            <p role="alert" className="text-[12px]" style={{ color: 'var(--color-pink)' }}>
              {editSaveError}
            </p>
          )}
          <div className="flex gap-3 flex-wrap items-center mt-1">
            <button type="submit" disabled={editSaving || editPhotoBusy} className="neon-cta">
              {editSaving ? 'Sparar…' : 'Spara'}
            </button>
            <button type="button" onClick={handleCancelEdit} className="neon-cta-outline">
              Avbryt
            </button>
          </div>
          <div className="mt-2">
            {!showDeleteConfirm ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-[13px] font-semibold flex items-center gap-1.5"
                style={{ color: 'var(--color-pink)' }}
              >
                <Trash size={12} /> Ta bort önskemål
              </button>
            ) : (
              <div role="alert" className="flex gap-3 items-center flex-wrap">
                <span className="text-[13px]" style={{ color: 'var(--color-ink)' }}>
                  Är du säker?
                </span>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="text-[13px] font-bold"
                  style={{ color: 'var(--color-pink)' }}
                >
                  Ja, ta bort
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="text-[13px]"
                  style={{ color: 'var(--color-muted)' }}
                >
                  Nej, behåll
                </button>
              </div>
            )}
          </div>
        </form>
      ) : (
        <div className="flex gap-3 items-center p-3 pl-4">
          {/* Drag handle */}
          <button
            ref={setActivatorNodeRef}
            {...listeners}
            aria-label="Dra för att ändra ordning"
            style={{ touchAction: 'none' }}
            className="shrink-0 flex items-center justify-center min-h-[44px] w-5 cursor-grab active:cursor-grabbing"
          >
            <GripDots size={18} color="rgba(155,154,198,0.7)" />
          </button>

          {/* Thumbnail — own photo wins over external image URL */}
          {(item.photoData ?? item.imageUrl) && !imageLoadError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.photoData ?? item.imageUrl}
              alt={item.title}
              width={56}
              height={56}
              className="shrink-0 object-cover"
              style={{ width: 56, height: 56, borderRadius: 12, background: 'rgba(255,255,255,0.05)' }}
              onError={() => setImageLoadError(true)}
            />
          ) : (
            <div
              aria-hidden="true"
              className="shrink-0"
              style={{
                width: 56,
                height: 56,
                borderRadius: 12,
                background: `linear-gradient(135deg, ${accent}25, ${accent}08)`,
                border: `1px solid ${accent}40`,
              }}
            />
          )}

          {/* Body */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2">
              <h2
                className="font-display font-semibold text-[15px] leading-tight flex-1"
                style={{ color: 'var(--color-ink)' }}
              >
                {item.title}
              </h2>
              <button
                type="button"
                onClick={handleToggleFavorite}
                aria-label={item.isFavorite ? `Ta bort ${item.title} från favoriter` : `Markera ${item.title} som favorit`}
                className="shrink-0 flex items-center justify-center"
                style={{ width: 36, height: 36 }}
              >
                <Heart
                  size={16}
                  color={item.isFavorite ? '#FF7AB8' : 'rgba(255,255,255,0.25)'}
                  className={item.isFavorite ? 'anim-heart' : ''}
                  style={item.isFavorite ? { filter: 'drop-shadow(0 0 6px rgba(255,122,184,0.7))' } : undefined}
                />
              </button>
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {item.price !== undefined && (
                <span
                  className="text-[11px] font-bold font-tabular"
                  style={{ color: accent }}
                >
                  ~{item.price} kr
                </span>
              )}
              {item.note && (
                <span
                  className="text-[11px] italic truncate"
                  style={{ color: 'var(--color-muted)', maxWidth: '60%' }}
                >
                  &ldquo;{item.note}&rdquo;
                </span>
              )}
            </div>
            {item.productUrl && isSafeUrl(item.productUrl) && (
              <a
                href={item.productUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block mt-1 text-[11px] font-mono truncate hover:underline"
                style={{ color: 'var(--color-muted)' }}
              >
                {item.productUrl}
              </a>
            )}
            {favoriteError && (
              <p role="alert" className="text-[11px] mt-1" style={{ color: 'var(--color-pink)' }}>
                Du kan ha max 5 favoriter.
              </p>
            )}
          </div>

          {/* Right column: star + edit */}
          <div className="shrink-0 flex flex-col items-center gap-2">
            <span className="anim-star-pop" style={{ animationDelay: `${index * 0.4}s` }}>
              <Star size={14} color={accent} style={{ filter: `drop-shadow(0 0 4px ${accent})` }} />
            </span>
            <button
              type="button"
              onClick={handleStartEdit}
              aria-label={`Redigera ${item.title}`}
              className="flex items-center justify-center rounded-full"
              style={{
                width: 32,
                height: 32,
                background: 'rgba(255,255,255,0.04)',
                color: 'var(--color-muted)',
              }}
            >
              <Pencil size={12} />
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

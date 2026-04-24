'use client';
import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { updateWishItem, deleteWishItem } from '@/lib/firebase/wishlist';
import type { WishItemDoc } from '@/types/firestore';

function isSafeUrl(url: string): boolean {
  return url.startsWith('https://') || url.startsWith('http://');
}

interface WishItemCardProps {
  item: WishItemDoc;
  wishlistId: string;
}

export function WishItemCard({ item, wishlistId }: WishItemCardProps) {
  const [editMode, setEditMode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);

  // Edit form state
  const [editTitle, setEditTitle] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editProductUrl, setEditProductUrl] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editTitleError, setEditTitleError] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editSaveError, setEditSaveError] = useState<string | null>(null);

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
    setEditTitleError(false);
    setEditSaveError(null);
    setShowDeleteConfirm(false);
    setEditMode(true);
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
      const SAFE_URL_PREFIXES = ['https://', 'http://'];
      const trimmedProductUrl = editProductUrl.trim() || undefined;
      const trimmedImageUrl = editImageUrl.trim() || undefined;
      if (trimmedProductUrl && !SAFE_URL_PREFIXES.some(p => trimmedProductUrl.startsWith(p))) {
        setEditSaveError('Länken måste börja med https:// eller http://');
        setEditSaving(false);
        return;
      }
      if (trimmedImageUrl && !SAFE_URL_PREFIXES.some(p => trimmedImageUrl.startsWith(p))) {
        setEditSaveError('Bildlänken måste börja med https:// eller http://');
        setEditSaving(false);
        return;
      }
      const changes: Partial<Omit<WishItemDoc, 'id' | 'createdAt' | 'position'>> = {
        title: editTitle.trim(),
        productUrl: trimmedProductUrl,
        imageUrl: trimmedImageUrl,
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
      // item disappears via onSnapshot — no local state cleanup needed
    } catch {
      setEditSaveError('Något gick fel. Försök igen.');
    }
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      role="listitem"
      className="bg-[#FFF0E8] border border-[#E5D5CC] rounded-2xl shadow-sm hover:shadow-md transition-shadow p-4 flex gap-3 items-start"
    >
      {/* Drag handle — ONLY this element has touch-action:none */}
      <button
        ref={setActivatorNodeRef}
        {...listeners}
        aria-label="Dra för att ändra ordning"
        style={{ touchAction: 'none' }}
        className="flex-shrink-0 flex items-center justify-center w-6 min-h-[44px] text-gray-400 cursor-grab active:cursor-grabbing"
      >
        <svg width="12" height="20" viewBox="0 0 12 20" fill="currentColor" aria-hidden="true">
          <circle cx="3" cy="4" r="1.5"/><circle cx="9" cy="4" r="1.5"/>
          <circle cx="3" cy="10" r="1.5"/><circle cx="9" cy="10" r="1.5"/>
          <circle cx="3" cy="16" r="1.5"/><circle cx="9" cy="16" r="1.5"/>
        </svg>
      </button>

      {editMode ? (
        /* Edit mode — form takes full content width */
        <form onSubmit={handleSave} className="flex-1 flex flex-col gap-3">
          <div>
            <label htmlFor={`title-${item.id}`} className="text-sm text-gray-500">Titel</label>
            <input
              id={`title-${item.id}`}
              type="text"
              required
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full border border-[#E5D5CC] rounded-md px-3 py-2 text-xl font-semibold text-[#171717] bg-white mt-1"
            />
            {editTitleError && <p role="alert" className="text-red-600 text-sm mt-1">Titel krävs</p>}
          </div>
          <div>
            <label htmlFor={`price-${item.id}`} className="text-sm text-gray-500">Ungefärligt pris (kr)</label>
            <input
              id={`price-${item.id}`}
              type="number"
              min="0"
              value={editPrice}
              onChange={(e) => setEditPrice(e.target.value)}
              className="w-full border border-[#E5D5CC] rounded-md px-3 py-2 text-sm text-[#171717] bg-white mt-1"
            />
          </div>
          <div>
            <label htmlFor={`productUrl-${item.id}`} className="text-sm text-gray-500">Länk till produkt</label>
            <input
              id={`productUrl-${item.id}`}
              type="url"
              value={editProductUrl}
              onChange={(e) => setEditProductUrl(e.target.value)}
              className="w-full border border-[#E5D5CC] rounded-md px-3 py-2 text-sm text-[#171717] bg-white mt-1"
            />
          </div>
          <div>
            <label htmlFor={`imageUrl-${item.id}`} className="text-sm text-gray-500">Bildlänk</label>
            <input
              id={`imageUrl-${item.id}`}
              type="url"
              value={editImageUrl}
              onChange={(e) => setEditImageUrl(e.target.value)}
              className="w-full border border-[#E5D5CC] rounded-md px-3 py-2 text-sm text-[#171717] bg-white mt-1"
            />
          </div>
          <div>
            <label htmlFor={`note-${item.id}`} className="text-sm text-gray-500">Anteckning</label>
            <textarea
              id={`note-${item.id}`}
              rows={3}
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              className="w-full border border-[#E5D5CC] rounded-md px-3 py-2 text-base text-[#171717] bg-white mt-1 resize-none"
            />
          </div>
          {editSaveError && <p role="alert" className="text-red-600 text-sm">Något gick fel. Försök igen.</p>}
          <div className="flex gap-3 flex-wrap items-center">
            <button
              type="submit"
              disabled={editSaving}
              className="bg-[#F97316] hover:bg-[#EA6C0A] text-white rounded-xl px-4 py-2 font-semibold min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Spara önskemål
            </button>
            <button
              type="button"
              onClick={handleCancelEdit}
              className="text-gray-500 hover:underline px-4 py-2 min-h-[44px]"
            >
              Avbryt redigering
            </button>
          </div>
          <div className="mt-2">
            {!showDeleteConfirm ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-red-600 text-sm hover:underline min-h-[44px]"
              >
                Ta bort önskemål
              </button>
            ) : (
              <div role="alert" className="flex gap-3 items-center flex-wrap">
                <span className="text-sm text-[#171717]">Är du säker?</span>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="text-red-600 text-sm hover:underline min-h-[44px]"
                >
                  Ja, ta bort
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="text-gray-500 text-sm hover:underline min-h-[44px]"
                >
                  Nej, behåll
                </button>
              </div>
            )}
          </div>
        </form>
      ) : (
        /* Read mode */
        <>
          {/* Content area */}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold text-[#171717] leading-tight">{item.title}</h2>
            {item.price !== undefined && (
              <span className="text-sm text-gray-500">~{item.price} kr</span>
            )}
            {item.productUrl && isSafeUrl(item.productUrl) && (
              <a
                href={item.productUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-500 truncate block max-w-full hover:underline"
              >
                {item.productUrl}
              </a>
            )}
            {item.note && (
              <p className="text-base text-[#171717] line-clamp-3">{item.note}</p>
            )}
          </div>

          {/* Right column: thumbnail + Redigera button — read mode only */}
          <div className="flex-shrink-0 flex flex-col items-end gap-2">
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
            <button
              onClick={handleStartEdit}
              aria-label={`Redigera ${item.title}`}
              className="text-sm text-[#F97316] hover:underline min-h-[44px] flex items-center"
            >
              Redigera
            </button>
          </div>
        </>
      )}
    </li>
  );
}

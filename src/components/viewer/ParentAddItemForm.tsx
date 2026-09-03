'use client';
import { useState } from 'react';
import { auth } from '@/lib/firebase/client';
import { updateWishItem } from '@/lib/firebase/wishlist';
import { normalizeUrl, isSafeUrl } from '@/lib/url';
import type { WishItemDoc } from '@/types/firestore';

interface ParentAddItemFormProps {
  wishlistId: string;
  /** Pass an item to edit it in place; leave it out to add a new wish. */
  item?: WishItemDoc;
  onClose: () => void;
  onError: (msg: string) => void;
}

export function ParentAddItemForm({ wishlistId, item, onClose, onError }: ParentAddItemFormProps) {
  const isEdit = item !== undefined;
  const [title, setTitle] = useState(item?.title ?? '');
  const [productUrl, setProductUrl] = useState(item?.productUrl ?? '');
  const [note, setNote] = useState(item?.note ?? '');
  const [price, setPrice] = useState<number | ''>(item?.price ?? '');
  const [saving, setSaving] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);

  // Two forms can be on screen at once (add + edit), so the field ids have to
  // stay unique or the labels point at the wrong input.
  const fieldId = (name: string) => `parent-item-${name}-${item?.id ?? 'new'}`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTitleError(null);
    if (!title.trim()) {
      setTitleError('Titel krävs');
      return;
    }
    const normalizedProductUrl = normalizeUrl(productUrl);
    if (normalizedProductUrl && !isSafeUrl(normalizedProductUrl)) {
      onError('Länken måste vara en webbadress (https://…)');
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        // Parents may write items directly under firestore.rules, as long as
        // they leave isFavorite alone — which this form never touches.
        await updateWishItem(wishlistId, item!.id, {
          title: title.trim(),
          productUrl: normalizedProductUrl || undefined,
          note: note.trim() || undefined,
          price: price !== '' ? Number(price) : undefined,
        });
        onClose();
        return;
      }
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Not authenticated');
      const res = await fetch('/api/wishlist/add-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken,
          wishlistId,
          title: title.trim(),
          ...(normalizedProductUrl ? { productUrl: normalizedProductUrl } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
          ...(price !== '' ? { price: Number(price) } : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        onError(body.error ?? 'Något gick fel. Försök igen.');
      } else {
        onClose();
      }
    } catch {
      onError('Något gick fel. Försök igen.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="light-card p-5 flex flex-col gap-3">
      <div>
        <label
          htmlFor={fieldId('title')}
          className="block mb-1.5 text-[10px] font-bold tracking-caps"
          style={{ color: 'var(--color-muted-light)' }}
        >
          Titel
        </label>
        <input
          id={fieldId('title')}
          type="text"
          required
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="light-input"
        />
        {titleError && (
          <p role="alert" className="text-[12px] mt-1" style={{ color: 'var(--color-destructive)' }}>
            {titleError}
          </p>
        )}
      </div>
      <div>
        <label
          htmlFor={fieldId('price')}
          className="block mb-1.5 text-[10px] font-bold tracking-caps"
          style={{ color: 'var(--color-muted-light)' }}
        >
          Ungefärligt pris (kr)
        </label>
        <input
          id={fieldId('price')}
          type="number"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
          className="light-input"
        />
      </div>
      <div>
        <label
          htmlFor={fieldId('url')}
          className="block mb-1.5 text-[10px] font-bold tracking-caps"
          style={{ color: 'var(--color-muted-light)' }}
        >
          Länk till produkt
        </label>
        <input
          id={fieldId('url')}
          type="url"
          value={productUrl}
          onChange={(e) => setProductUrl(e.target.value)}
          onBlur={(e) => setProductUrl(normalizeUrl(e.target.value))}
          className="light-input font-mono"
        />
      </div>
      <div>
        <label
          htmlFor={fieldId('note')}
          className="block mb-1.5 text-[10px] font-bold tracking-caps"
          style={{ color: 'var(--color-muted-light)' }}
        >
          Anteckning
        </label>
        <textarea
          id={fieldId('note')}
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="light-input italic resize-none"
        />
      </div>
      <div className="flex gap-3 flex-wrap mt-1">
        <button type="submit" disabled={saving} className="light-cta">
          {saving ? 'Sparar…' : isEdit ? 'Spara ändringar' : 'Lägg till önskemål'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-3 text-[13px] font-semibold"
          style={{ color: 'var(--color-muted-light)' }}
        >
          Avbryt
        </button>
      </div>
    </form>
  );
}

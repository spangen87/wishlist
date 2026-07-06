'use client';
import { useState } from 'react';
import { auth } from '@/lib/firebase/client';
import { normalizeUrl, isSafeUrl } from '@/lib/url';

interface ParentAddItemFormProps {
  wishlistId: string;
  onClose: () => void;
  onError: (msg: string) => void;
}

export function ParentAddItemForm({ wishlistId, onClose, onError }: ParentAddItemFormProps) {
  const [title, setTitle] = useState('');
  const [productUrl, setProductUrl] = useState('');
  const [note, setNote] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);

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
          htmlFor="parent-item-title"
          className="block mb-1.5 text-[10px] font-bold tracking-caps"
          style={{ color: 'var(--color-muted-light)' }}
        >
          Titel
        </label>
        <input
          id="parent-item-title"
          type="text"
          required
          autoFocus
          maxLength={200}
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
          htmlFor="parent-item-price"
          className="block mb-1.5 text-[10px] font-bold tracking-caps"
          style={{ color: 'var(--color-muted-light)' }}
        >
          Ungefärligt pris (kr)
        </label>
        <input
          id="parent-item-price"
          type="number"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
          className="light-input"
        />
      </div>
      <div>
        <label
          htmlFor="parent-item-url"
          className="block mb-1.5 text-[10px] font-bold tracking-caps"
          style={{ color: 'var(--color-muted-light)' }}
        >
          Länk till produkt
        </label>
        <input
          id="parent-item-url"
          type="url"
          value={productUrl}
          onChange={(e) => setProductUrl(e.target.value)}
          onBlur={(e) => setProductUrl(normalizeUrl(e.target.value))}
          className="light-input font-mono text-[12px]"
        />
      </div>
      <div>
        <label
          htmlFor="parent-item-note"
          className="block mb-1.5 text-[10px] font-bold tracking-caps"
          style={{ color: 'var(--color-muted-light)' }}
        >
          Anteckning
        </label>
        <textarea
          id="parent-item-note"
          rows={2}
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="light-input italic resize-none"
        />
      </div>
      <div className="flex gap-3 flex-wrap mt-1">
        <button type="submit" disabled={saving} className="light-cta">
          {saving ? 'Sparar…' : 'Lägg till önskemål'}
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

'use client';
import { useState } from 'react';
import { auth } from '@/lib/firebase/client';

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
          ...(productUrl.trim() ? { productUrl: productUrl.trim() } : {}),
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
    <form
      onSubmit={handleSubmit}
      className="bg-[#FFF0E8] border border-[#E5D5CC] rounded-2xl p-4 flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="parent-item-title" className="text-sm text-gray-500">
          Titel
        </label>
        <input
          id="parent-item-title"
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border border-[#E5D5CC] rounded-md px-3 py-2 text-xl font-semibold text-[#171717] bg-white"
        />
        {titleError && (
          <p role="alert" className="text-red-600 text-sm">
            {titleError}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="parent-item-price" className="text-sm text-gray-500">
          Ungefärligt pris (kr)
        </label>
        <input
          id="parent-item-price"
          type="number"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
          className="w-full border border-[#E5D5CC] rounded-md px-3 py-2 text-sm text-[#171717] bg-white"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="parent-item-url" className="text-sm text-gray-500">
          Länk till produkt
        </label>
        <input
          id="parent-item-url"
          type="url"
          value={productUrl}
          onChange={(e) => setProductUrl(e.target.value)}
          className="w-full border border-[#E5D5CC] rounded-md px-3 py-2 text-sm text-[#171717] bg-white"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="parent-item-note" className="text-sm text-gray-500">
          Anteckning
        </label>
        <textarea
          id="parent-item-note"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full border border-[#E5D5CC] rounded-md px-3 py-2 text-base text-[#171717] bg-white resize-none"
        />
      </div>
      <div className="flex gap-3 flex-wrap">
        <button
          type="submit"
          disabled={saving}
          className="bg-[#F97316] hover:bg-[#EA6C0A] text-white rounded-xl px-4 py-2 font-semibold min-h-[44px] disabled:opacity-50 transition-colors"
        >
          {saving ? 'Sparar…' : 'Lägg till önskemål'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-500 hover:underline px-4 py-2 min-h-[44px]"
        >
          Avbryt
        </button>
      </div>
    </form>
  );
}

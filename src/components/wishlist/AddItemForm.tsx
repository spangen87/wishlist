'use client';
import { useState } from 'react';
import { addWishItem } from '@/lib/firebase/wishlist';

interface AddItemFormProps {
  wishlistId: string;
  lastPosition: string | null;
  onClose: () => void;
}

export function AddItemForm({ wishlistId, lastPosition, onClose }: AddItemFormProps) {
  const [title, setTitle] = useState('');
  const [productUrl, setProductUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [note, setNote] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTitleError(null);
    setSaveError(null);
    if (!title.trim()) {
      setTitleError('Titel krävs');
      return;
    }
    setSaving(true);
    try {
      await addWishItem(
        wishlistId,
        {
          title: title.trim(),
          ...(productUrl.trim() ? { productUrl: productUrl.trim() } : {}),
          ...(imageUrl.trim() ? { imageUrl: imageUrl.trim() } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
          ...(price !== '' ? { price: Number(price) } : {}),
        },
        lastPosition
      );
      onClose();
    } catch {
      setSaveError('Något gick fel. Försök igen.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-[#FFF0E8] border border-[#E5D5CC] rounded-2xl p-4 flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="title" className="text-sm text-gray-500">Titel</label>
        <input
          id="title"
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border border-[#E5D5CC] rounded-md px-3 py-2 text-xl font-semibold text-[#171717] bg-white"
        />
        {titleError && (
          <p role="alert" className="text-red-600 text-sm">Titel krävs</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="price" className="text-sm text-gray-500">Ungefärligt pris (kr)</label>
        <input
          id="price"
          type="number"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
          className="w-full border border-[#E5D5CC] rounded-md px-3 py-2 text-sm text-[#171717] bg-white"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="productUrl" className="text-sm text-gray-500">Länk till produkt</label>
        <input
          id="productUrl"
          type="url"
          value={productUrl}
          onChange={(e) => setProductUrl(e.target.value)}
          className="w-full border border-[#E5D5CC] rounded-md px-3 py-2 text-sm text-[#171717] bg-white"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="imageUrl" className="text-sm text-gray-500">Bildlänk</label>
        <input
          id="imageUrl"
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          className="w-full border border-[#E5D5CC] rounded-md px-3 py-2 text-sm text-[#171717] bg-white"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="note" className="text-sm text-gray-500">Anteckning</label>
        <textarea
          id="note"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full border border-[#E5D5CC] rounded-md px-3 py-2 text-base text-[#171717] bg-white resize-none"
        />
      </div>

      {saveError && (
        <p role="alert" className="text-red-600 text-sm">Något gick fel. Försök igen.</p>
      )}

      <div className="flex gap-3 flex-wrap">
        <button
          type="submit"
          disabled={saving}
          className="bg-[#F97316] hover:bg-[#EA6C0A] text-white rounded-xl px-4 py-2 font-semibold min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Lägg till önskemål
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-500 hover:underline px-4 py-2 min-h-[44px]"
        >
          Avbryt tillägg
        </button>
      </div>
    </form>
  );
}

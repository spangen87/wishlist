'use client';
import { useState } from 'react';
import { addWishItem } from '@/lib/firebase/wishlist';
import { Sparkle } from '@/components/galaxy';

interface AddItemFormProps {
  wishlistId: string;
  lastPosition: string | null;
  onClose: () => void;
}

const FIELDS = [
  { id: 'title', label: 'Vad önskar du?', accent: '#FF7AB8' },
  { id: 'price', label: 'Ungefärligt pris', accent: '#7DE3FF' },
  { id: 'productUrl', label: 'Länk', accent: '#FFD36E' },
  { id: 'imageUrl', label: 'Bild', accent: '#B28BFF' },
] as const;

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

  function renderField(id: (typeof FIELDS)[number]['id'], label: string, accent: string) {
    const isPrice = id === 'price';
    const isUrl = id === 'productUrl' || id === 'imageUrl';
    const value =
      id === 'title'
        ? title
        : id === 'price'
        ? price
        : id === 'productUrl'
        ? productUrl
        : imageUrl;
    const setValue =
      id === 'title'
        ? (v: string) => setTitle(v)
        : id === 'price'
        ? (v: string) => setPrice(v === '' ? '' : Number(v))
        : id === 'productUrl'
        ? (v: string) => setProductUrl(v)
        : (v: string) => setImageUrl(v);
    return (
      <div key={id}>
        <label
          htmlFor={`add-${id}`}
          className="block mb-1.5 text-[10px] font-bold tracking-caps"
          style={{ color: accent }}
        >
          {label}
        </label>
        <input
          id={`add-${id}`}
          type={isPrice ? 'number' : isUrl ? 'url' : 'text'}
          min={isPrice ? '0' : undefined}
          required={id === 'title'}
          value={value as string | number}
          onChange={(e) => setValue(e.target.value)}
          placeholder={
            id === 'imageUrl'
              ? 'Klistra in bildlänk'
              : id === 'productUrl'
              ? 'https://…'
              : undefined
          }
          className={`night-input ${isUrl ? 'font-mono text-[12px]' : ''}`}
          style={{ boxShadow: `inset 0 0 0 1px ${accent}33` }}
        />
        {id === 'title' && titleError && (
          <p role="alert" className="text-[12px] mt-1" style={{ color: 'var(--color-pink)' }}>
            {titleError}
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="night-card flex flex-col gap-4 p-5"
    >
      {FIELDS.map((f) => renderField(f.id, f.label, f.accent))}

      <div>
        <label
          htmlFor="add-note"
          className="block mb-1.5 text-[10px] font-bold tracking-caps"
          style={{ color: '#85F2CA' }}
        >
          Anteckning
        </label>
        <textarea
          id="add-note"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="night-input italic resize-none"
          style={{ boxShadow: '0 0 16px rgba(133,242,202,0.18)', borderColor: 'rgba(133,242,202,0.4)' }}
        />
      </div>

      {saveError && (
        <p role="alert" className="text-[12px]" style={{ color: 'var(--color-pink)' }}>
          {saveError}
        </p>
      )}

      <div className="flex gap-3 flex-wrap mt-1">
        <button type="submit" disabled={saving} className="neon-cta">
          <Sparkle size={14} color="#fff" /> Tänd stjärnan
        </button>
        <button type="button" onClick={onClose} className="neon-cta-outline">
          Avbryt
        </button>
      </div>
    </form>
  );
}

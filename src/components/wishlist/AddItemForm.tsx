'use client';
import { useEffect, useRef, useState } from 'react';
import { addWishItem } from '@/lib/firebase/wishlist';
import { normalizeUrl, isSafeUrl } from '@/lib/url';
import { fileToPhotoDataUrl, MAX_PHOTOS_PER_LIST } from '@/lib/image';
import { Sparkle, Camera } from '@/components/galaxy';

interface AddItemFormProps {
  wishlistId: string;
  lastPosition: string | null;
  photoCount: number;
  onClose: () => void;
}

const FIELDS = [
  { id: 'title', label: 'Vad önskar du?', accent: '#FF7AB8' },
  { id: 'price', label: 'Ungefärligt pris', accent: '#7DE3FF' },
  { id: 'productUrl', label: 'Länk', accent: '#FFD36E' },
  { id: 'imageUrl', label: 'Bild', accent: '#B28BFF' },
] as const;

export function AddItemForm({ wishlistId, lastPosition, photoCount, onClose }: AddItemFormProps) {
  const [title, setTitle] = useState('');
  const [productUrl, setProductUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [note, setNote] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const atPhotoLimit = photoCount >= MAX_PHOTOS_PER_LIST;

  useEffect(() => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoError(null);
    setPhotoBusy(true);
    try {
      setPhotoData(await fileToPhotoDataUrl(file));
    } catch {
      setPhotoError('Kunde inte läsa bilden. Prova ett annat foto.');
    } finally {
      setPhotoBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTitleError(null);
    setSaveError(null);
    if (!title.trim()) {
      setTitleError('Titel krävs');
      return;
    }
    const normalizedProductUrl = normalizeUrl(productUrl);
    const normalizedImageUrl = normalizeUrl(imageUrl);
    if (normalizedProductUrl && !isSafeUrl(normalizedProductUrl)) {
      setSaveError('Länken måste vara en webbadress (https://…)');
      return;
    }
    if (normalizedImageUrl && !isSafeUrl(normalizedImageUrl)) {
      setSaveError('Bildlänken måste vara en webbadress (https://…)');
      return;
    }
    setSaving(true);
    try {
      await addWishItem(
        wishlistId,
        {
          title: title.trim(),
          ...(normalizedProductUrl ? { productUrl: normalizedProductUrl } : {}),
          ...(normalizedImageUrl ? { imageUrl: normalizedImageUrl } : {}),
          ...(photoData ? { photoData } : {}),
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
          maxLength={id === 'title' ? 200 : isUrl ? 2048 : undefined}
          required={id === 'title'}
          autoFocus={id === 'title'}
          value={value as string | number}
          onChange={(e) => setValue(e.target.value)}
          onBlur={isUrl ? (e) => setValue(normalizeUrl(e.target.value)) : undefined}
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
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      className="night-card flex flex-col gap-4 p-5"
    >
      {FIELDS.map((f) => renderField(f.id, f.label, f.accent))}

      <div>
        <label
          className="block mb-1.5 text-[10px] font-bold tracking-caps"
          style={{ color: '#FFD36E' }}
        >
          Eget foto
        </label>
        {photoData ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoData}
              alt="Ditt foto"
              className="object-cover"
              style={{ width: 56, height: 56, borderRadius: 12 }}
            />
            <button
              type="button"
              onClick={() => setPhotoData(null)}
              className="text-[13px] font-semibold"
              style={{ color: 'var(--color-pink)' }}
            >
              Ta bort foto
            </button>
          </div>
        ) : atPhotoLimit ? (
          <p className="text-[12px]" style={{ color: 'var(--color-muted)' }}>
            Listan har redan {MAX_PHOTOS_PER_LIST} foton (max). Ta bort ett foto
            från ett annat önskemål först.
          </p>
        ) : (
          <>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={photoBusy}
              className="neon-cta-outline flex items-center gap-1.5"
            >
              <Camera size={14} /> {photoBusy ? 'Förbereder…' : 'Ta ett foto'}
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
        {photoError && (
          <p role="alert" className="text-[12px] mt-1" style={{ color: 'var(--color-pink)' }}>
            {photoError}
          </p>
        )}
      </div>

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
          maxLength={1000}
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
        <button type="submit" disabled={saving || photoBusy} className="neon-cta">
          <Sparkle size={14} color="#fff" /> {saving ? 'Sparar…' : 'Tänd stjärnan'}
        </button>
        <button type="button" onClick={onClose} className="neon-cta-outline">
          Avbryt
        </button>
      </div>
    </form>
  );
}

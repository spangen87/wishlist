// Own photos are stored inline in the wish item document as compressed JPEG
// data URLs. The Spark (free) plan no longer has Cloud Storage access, so
// Firestore is the only no-cost place to keep them. The caps below bound the
// cost: a photo is ~220 KB max and each list holds at most MAX_PHOTOS_PER_LIST
// photos. MAX_PHOTO_DATA_CHARS must match the size cap in firestore.rules.
export const PHOTO_DATA_PREFIX = 'data:image/jpeg;base64,';
export const MAX_PHOTO_DATA_CHARS = 300_000;
export const MAX_PHOTOS_PER_LIST = 20;

export function isValidPhotoDataUrl(value: string): boolean {
  return (
    value.startsWith(PHOTO_DATA_PREFIX) &&
    value.length <= MAX_PHOTO_DATA_CHARS &&
    /^[A-Za-z0-9+/=]+$/.test(value.slice(PHOTO_DATA_PREFIX.length))
  );
}

interface LoadedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
}

// iOS Safari note: HTMLImageElement.decode() intermittently rejects large
// images (12 MP+ camera photos) even though they are fine, so this never
// calls decode(). Preferred path is createImageBitmap (no such size issue);
// fallback is <img> with onload, keeping the object URL alive until the
// caller has finished drawing (Safari may decode lazily at draw time).
async function loadImage(file: File): Promise<LoadedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      let bitmap: ImageBitmap;
      try {
        bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      } catch {
        // Older Safari rejects the options bag — retry without it.
        bitmap = await createImageBitmap(file);
      }
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
      };
    } catch {
      // Fall through to the <img> path (e.g. formats createImageBitmap rejects).
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Image decode failed'));
      el.src = url;
    });
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      cleanup: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

/**
 * Downscale and compress a photo from the camera or gallery into a JPEG
 * data URL small enough to store inline in a Firestore document.
 * Throws if the file cannot be decoded as an image or cannot be
 * compressed under MAX_PHOTO_DATA_CHARS.
 */
export async function fileToPhotoDataUrl(file: File): Promise<string> {
  const { source, width: srcWidth, height: srcHeight, cleanup } = await loadImage(file);
  try {
    for (const maxDim of [800, 640, 480]) {
      const scale = Math.min(1, maxDim / Math.max(srcWidth, srcHeight));
      const width = Math.max(1, Math.round(srcWidth * scale));
      const height = Math.max(1, Math.round(srcHeight * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas is not supported');

      // JPEG has no alpha channel — flatten transparency onto white.
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(source, 0, 0, width, height);

      for (const quality of [0.8, 0.7, 0.6, 0.5]) {
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        if (dataUrl.length <= MAX_PHOTO_DATA_CHARS) return dataUrl;
      }
    }
    throw new Error('Could not compress image under the size limit');
  } finally {
    cleanup();
  }
}

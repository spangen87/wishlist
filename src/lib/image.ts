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

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Downscale and compress a photo from the camera or gallery into a JPEG
 * data URL small enough to store inline in a Firestore document.
 * Throws if the file cannot be decoded as an image or cannot be
 * compressed under MAX_PHOTO_DATA_CHARS.
 */
export async function fileToPhotoDataUrl(file: File): Promise<string> {
  const img = await loadImage(file);
  for (const maxDim of [800, 640, 480]) {
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not supported');

    // JPEG has no alpha channel — flatten transparency onto white.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    for (const quality of [0.8, 0.7, 0.6, 0.5]) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      if (dataUrl.length <= MAX_PHOTO_DATA_CHARS) return dataUrl;
    }
  }
  throw new Error('Could not compress image under the size limit');
}

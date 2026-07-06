import {
  isValidPhotoDataUrl,
  MAX_PHOTO_DATA_CHARS,
  PHOTO_DATA_PREFIX,
} from '@/lib/image';

describe('isValidPhotoDataUrl', () => {
  it('accepts a JPEG data URL under the size cap', () => {
    expect(isValidPhotoDataUrl(PHOTO_DATA_PREFIX + 'aGVsbG8=')).toBe(true);
  });

  it('accepts a JPEG data URL exactly at the size cap', () => {
    const payload = 'A'.repeat(MAX_PHOTO_DATA_CHARS - PHOTO_DATA_PREFIX.length);
    expect(isValidPhotoDataUrl(PHOTO_DATA_PREFIX + payload)).toBe(true);
  });

  it('rejects a data URL over the size cap', () => {
    const payload = 'A'.repeat(MAX_PHOTO_DATA_CHARS - PHOTO_DATA_PREFIX.length + 1);
    expect(isValidPhotoDataUrl(PHOTO_DATA_PREFIX + payload)).toBe(false);
  });

  it('rejects non-JPEG data URLs', () => {
    expect(isValidPhotoDataUrl('data:text/html;base64,PGh0bWw+')).toBe(false);
    expect(isValidPhotoDataUrl('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false);
  });

  it('rejects http(s) URLs and empty strings', () => {
    expect(isValidPhotoDataUrl('https://example.com/a.jpg')).toBe(false);
    expect(isValidPhotoDataUrl('')).toBe(false);
  });

  it('rejects non-base64 payload characters', () => {
    expect(isValidPhotoDataUrl(PHOTO_DATA_PREFIX + '<script>')).toBe(false);
  });
});

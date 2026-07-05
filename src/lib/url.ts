export function isSafeUrl(url: string): boolean {
  return url.startsWith('https://') || url.startsWith('http://');
}

/**
 * Normalize a user-entered URL: trims whitespace and prepends https://
 * when no scheme is present (e.g. "www.lego.com" → "https://www.lego.com").
 * Values with an explicit scheme are returned as-is so unsafe schemes
 * can still be rejected by validation.
 */
export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

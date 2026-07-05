import { normalizeUrl, isSafeUrl } from '@/lib/url';

describe('normalizeUrl', () => {
  it('returns empty string for empty or whitespace input', () => {
    expect(normalizeUrl('')).toBe('');
    expect(normalizeUrl('   ')).toBe('');
  });

  it('prepends https:// when no scheme is present', () => {
    expect(normalizeUrl('www.lego.com/produkt')).toBe('https://www.lego.com/produkt');
    expect(normalizeUrl('lego.com')).toBe('https://lego.com');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeUrl('  www.lego.com  ')).toBe('https://www.lego.com');
  });

  it('keeps existing http/https schemes unchanged', () => {
    expect(normalizeUrl('https://lego.com')).toBe('https://lego.com');
    expect(normalizeUrl('http://lego.com')).toBe('http://lego.com');
  });

  it('leaves other schemes as-is so validation can reject them', () => {
    expect(normalizeUrl('javascript:alert(1)')).toBe('javascript:alert(1)');
    expect(normalizeUrl('ftp://example.com')).toBe('ftp://example.com');
  });
});

describe('isSafeUrl', () => {
  it('accepts http and https URLs', () => {
    expect(isSafeUrl('https://lego.com')).toBe(true);
    expect(isSafeUrl('http://lego.com')).toBe(true);
  });

  it('rejects other schemes', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('ftp://example.com')).toBe(false);
  });
});

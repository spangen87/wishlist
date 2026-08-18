import { canActOnPurchases } from '@/lib/purchase-access';

describe('canActOnPurchases — surprise mode', () => {
  const VIEWER = 'viewer-1';
  const PARENT = 'parent-1';

  it('lets viewers act on an ordinary list', () => {
    expect(
      canActOnPurchases(VIEWER, { viewerUids: [VIEWER], parentUids: [PARENT] })
    ).toBe(true);
  });

  it('lets parents act when the list is not in surprise mode', () => {
    expect(
      canActOnPurchases(PARENT, { viewerUids: [VIEWER], parentUids: [PARENT] })
    ).toBe(true);
    expect(
      canActOnPurchases(PARENT, {
        viewerUids: [VIEWER],
        parentUids: [PARENT],
        hidePurchases: false,
      })
    ).toBe(true);
  });

  it('locks parents out when the list is in surprise mode', () => {
    expect(
      canActOnPurchases(PARENT, {
        viewerUids: [VIEWER],
        parentUids: [PARENT],
        hidePurchases: true,
      })
    ).toBe(false);
  });

  it('still lets viewers act on a list in surprise mode', () => {
    expect(
      canActOnPurchases(VIEWER, {
        viewerUids: [VIEWER],
        parentUids: [PARENT],
        hidePurchases: true,
      })
    ).toBe(true);
  });

  it('lets a parent who is also a viewer act even in surprise mode', () => {
    expect(
      canActOnPurchases(PARENT, {
        viewerUids: [PARENT],
        parentUids: [PARENT],
        hidePurchases: true,
      })
    ).toBe(true);
  });

  it('denies strangers, and survives missing or malformed fields', () => {
    expect(canActOnPurchases('nobody', { viewerUids: [VIEWER], parentUids: [PARENT] })).toBe(false);
    expect(canActOnPurchases(PARENT, {})).toBe(false);
    expect(canActOnPurchases(PARENT, { viewerUids: null, parentUids: 'oops' })).toBe(false);
  });

  it('treats a non-boolean hidePurchases as not hidden', () => {
    // Only an explicit `true` hides the list; anything else is a normal list.
    expect(
      canActOnPurchases(PARENT, { parentUids: [PARENT], hidePurchases: 'yes' })
    ).toBe(true);
  });
});

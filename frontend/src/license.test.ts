import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cachedLicenseState, LICENSE_KEY, saveLicense } from './license';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  });
});

describe('license storage', () => {
  it('stores a trimmed license token', () => {
    saveLicense('  family-token  ');
    expect(store.get(LICENSE_KEY)).toBe('family-token');
  });
  it('keeps unknown tokens locked until verified', () => {
    expect(cachedLicenseState('new-token').unlocked).toBe(false);
    expect(cachedLicenseState('new-token').checking).toBe(true);
  });
  it('does not repeatedly check a fresh invalid verdict', () => {
    store.set('sb_license_verdict:kindred-coop', JSON.stringify({ token: 'bad-token', valid: false, checkedAt: Date.now() }));
    const state = cachedLicenseState('bad-token');
    expect(state.unlocked).toBe(false);
    expect(state.checking).toBe(false);
  });
});

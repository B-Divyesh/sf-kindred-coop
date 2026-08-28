export const LICENSE_KEY = 'sb_license:kindred-coop';
const VERDICT_KEY = 'sb_license_verdict:kindred-coop';
const DAY = 86_400_000;
const BILLING_BASE = import.meta.env.VITE_BILLING_BASE || 'https://api.sociobot.in';

export type LicenseState = { token: string | null; unlocked: boolean; checking: boolean; notice: string };

export function captureLicenseFromUrl(url = new URL(location.href)): string | null {
  const token = url.searchParams.get('license');
  if (!token) return localStorage.getItem(LICENSE_KEY);
  localStorage.setItem(LICENSE_KEY, token);
  url.searchParams.delete('license');
  history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  return token;
}

export function cachedLicenseState(token: string | null): LicenseState {
  if (!token) return { token: null, unlocked: false, checking: false, notice: '' };
  try {
    const cached = JSON.parse(localStorage.getItem(VERDICT_KEY) || '{}');
    if (cached.token === token && typeof cached.valid === 'boolean') {
      const stale = Date.now() - cached.checkedAt > DAY;
      return {
        token,
        unlocked: cached.valid,
        checking: stale,
        notice: !cached.valid && !stale ? 'This license is not active. You can restore another below.' : '',
      };
    }
  } catch { /* A corrupt local cache should simply be rechecked. */ }
  return { token, unlocked: false, checking: true, notice: 'Checking your family license…' };
}

export async function verifyLicense(token: string): Promise<LicenseState> {
  try {
    const response = await fetch(`${BILLING_BASE}/api/v1/products/kindred-coop/verify?license=${encodeURIComponent(token)}`);
    if (!response.ok) throw new Error('verification unavailable');
    const result = await response.json() as { valid: boolean; reason: string };
    localStorage.setItem(VERDICT_KEY, JSON.stringify({ token, valid: result.valid, checkedAt: Date.now() }));
    return result.valid
      ? { token, unlocked: true, checking: false, notice: 'Family game unlocked on this device.' }
      : { token, unlocked: false, checking: false, notice: 'This license is no longer active. You can restore another below.' };
  } catch {
    const cached = cachedLicenseState(token);
    return { ...cached, checking: false, notice: cached.unlocked ? 'Offline — using your last verified license.' : 'Could not check this license. Check your connection and try again.' };
  }
}

export function saveLicense(token: string): void {
  localStorage.setItem(LICENSE_KEY, token.trim());
  localStorage.removeItem(VERDICT_KEY);
}

export const checkoutUrl = `${BILLING_BASE}/api/v1/products/kindred-coop/checkout`;

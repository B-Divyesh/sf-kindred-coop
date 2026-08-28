import { test, expect, type Page } from 'playwright/test';
import AxeBuilder from '@axe-core/playwright';

const verdict = JSON.stringify({ token: 'e2e-family-license', valid: true, checkedAt: Date.now() });

async function matchSequence(host: Page, guest: Page, sequence: string[]) {
  for (const label of sequence) {
    await host.getByRole('button', { name: `Send ${label}` }).click();
    await expect(guest.getByText('Latest signal', { exact: true })).toBeVisible();
    await guest.getByRole('button', { name: `Choose ${label}` }).click();
  }
  await expect(host.getByRole('heading', { name: 'Signal found!' })).toBeVisible();
  await expect(guest.getByRole('heading', { name: 'Signal found!' })).toBeVisible();
}

test('two players finish all three puzzles in separate browser contexts', async ({ browser }) => {
  const hostContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await hostContext.addInitScript((cached) => {
    localStorage.setItem('kindred:onboarded', 'yes');
    localStorage.setItem('sb_license:kindred-coop', 'e2e-family-license');
    localStorage.setItem('sb_license_verdict:kindred-coop', cached);
  }, verdict);
  const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await guestContext.addInitScript(() => localStorage.setItem('kindred:onboarded', 'yes'));
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  const browserErrors: string[] = [];
  host.on('console', (msg) => { if (msg.type() === 'error') browserErrors.push(msg.text()); });
  guest.on('console', (msg) => { if (msg.type() === 'error') browserErrors.push(msg.text()); });

  await host.goto('/');
  await expect(host.getByRole('heading', { level: 1 })).toHaveText(/Two places/);
  const homeA11y = await new AxeBuilder({ page: host }).analyze();
  expect(homeA11y.violations.filter((item) => ['serious', 'critical'].includes(item.impact || ''))).toEqual([]);
  await host.getByRole('button', { name: 'Create invite link' }).click();
  await expect(host.getByRole('heading', { name: 'Moonbeam message' })).toBeVisible();
  const code = new URL(host.url()).searchParams.get('room');
  expect(code).toMatch(/^[A-Z0-9]{7}$/);

  await guest.goto(`/?join=${code}`);
  await expect(guest.getByRole('heading', { name: 'Moonbeam message' })).toBeVisible();
  await expect(host.getByText('Together', { exact: true })).toBeVisible();
  await matchSequence(host, guest, ['Moon', 'Leaf', 'Star', 'Ripple']);

  await host.getByRole('button', { name: 'Open the next field note' }).click();
  await expect(guest.getByRole('heading', { name: 'Stepping-stone trail' })).toBeVisible();
  await matchSequence(host, guest, ['Right', 'Down', 'Right', 'Up']);

  await host.getByRole('button', { name: 'Open the next field note' }).click();
  await expect(guest.getByRole('heading', { name: 'Moth field notes' })).toBeVisible();
  await matchSequence(host, guest, ['Crescent', 'Fern', 'Amber']);
  await host.getByRole('button', { name: 'Finish the journey' }).click();
  await expect(guest.getByRole('heading', { name: /carried the light/i })).toBeVisible();

  const roomA11y = await new AxeBuilder({ page: guest }).analyze();
  expect(roomA11y.violations.filter((item) => ['serious', 'critical'].includes(item.impact || ''))).toEqual([]);
  expect(await guest.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(browserErrors).toEqual([]);
  await hostContext.close();
  await guestContext.close();
});

test('shows useful invalid-room and offline states', async ({ page, context }) => {
  await page.addInitScript(() => localStorage.setItem('kindred:onboarded', 'yes'));
  await page.goto('/?join=NOTREAL');
  await expect(page.locator('.play-start .form-status')).toContainText('not found');
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(page.locator('.play-start .form-status')).toContainText('Offline');
});

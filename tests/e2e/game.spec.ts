import { test, expect, type Page } from 'playwright/test';
import AxeBuilder from '@axe-core/playwright';

const verdict = JSON.stringify({ token: 'valid-family-license', valid: true, checkedAt: Date.now() });

async function matchSequence(host: Page, guest: Page, sequence: string[]) {
  for (const label of sequence) {
    await host.getByRole('button', { name: `Send ${label}` }).click();
    await expect(guest.getByText('Latest shape', { exact: true })).toBeVisible();
    await guest.getByRole('button', { name: `Choose ${label}` }).click();
  }
  await expect(host.getByRole('heading', { name: 'Puzzle complete' })).toBeVisible();
  await expect(guest.getByRole('heading', { name: 'Puzzle complete' })).toBeVisible();
}

test('@claim:full-game active license provides all three puzzles', async ({ browser }) => {
  const hostContext = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: { 'x-forwarded-for': '203.0.113.16, 10.0.0.4' } });
  await hostContext.addInitScript((cached) => {
    localStorage.setItem('kindred:onboarded', 'yes');
    localStorage.setItem('sb_license:kindred-coop', 'valid-family-license');
    localStorage.setItem('sb_license_verdict:kindred-coop', cached);
  }, verdict);
  const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: { 'x-forwarded-for': '203.0.113.17, 10.0.0.4' } });
  await guestContext.addInitScript(() => localStorage.setItem('kindred:onboarded', 'yes'));
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  const browserErrors: string[] = [];
  host.on('console', (msg) => { if (msg.type() === 'error') browserErrors.push(msg.text()); });
  guest.on('console', (msg) => { if (msg.type() === 'error') browserErrors.push(msg.text()); });

  await host.goto('/demo');
  await host.getByRole('link', { name: 'Start for real' }).click();
  await expect(host.getByRole('heading', { level: 1 })).toHaveText('Play picture puzzles together');
  const homeA11y = await new AxeBuilder({ page: host }).analyze();
  expect(homeA11y.violations.filter((item) => ['serious', 'critical'].includes(item.impact || ''))).toEqual([]);
  await host.getByRole('button', { name: 'Create invite link' }).click();
  await expect(host.getByRole('heading', { name: 'Match four shapes' })).toBeVisible();
  const code = new URL(host.url()).searchParams.get('room');
  expect(code).toMatch(/^[A-Z0-9]{7}$/);

  await guest.goto(`/?join=${code}`);
  await expect(guest.getByRole('heading', { name: 'Match four shapes' })).toBeVisible();
  await expect(host.getByText('Both connected', { exact: true })).toBeVisible();
  await expect(host.getByRole('progressbar', { name: 'Match four shapes progress' })).toBeVisible();
  for (const activePage of [host, guest]) {
    const activeA11y = await new AxeBuilder({ page: activePage }).analyze();
    expect(activeA11y.violations.filter((item) => ['serious', 'critical'].includes(item.impact || ''))).toEqual([]);
  }
  await matchSequence(host, guest, ['Moon', 'Leaf', 'Star', 'Ripple']);

  await host.getByRole('button', { name: 'Start the next puzzle' }).click();
  await expect(guest.getByRole('heading', { name: 'Follow four directions' })).toBeVisible();
  for (const direction of ['Right', 'Down', 'Right', 'Up']) {
    await host.getByRole('button', { name: `Send ${direction}` }).click();
    await guest.keyboard.press(`Arrow${direction}`);
  }
  await expect(host.getByRole('heading', { name: 'Puzzle complete' })).toBeVisible();

  await host.getByRole('button', { name: 'Start the next puzzle' }).click();
  await expect(guest.getByRole('heading', { name: 'Match three symbols' })).toBeVisible();
  await matchSequence(host, guest, ['Crescent', 'Fern', 'Amber']);
  await host.getByRole('button', { name: 'Finish the game' }).click();
  await expect(guest.getByRole('heading', { name: 'You finished all three puzzles' })).toBeVisible();

  const roomA11y = await new AxeBuilder({ page: guest }).analyze();
  expect(roomA11y.violations.filter((item) => ['serious', 'critical'].includes(item.impact || ''))).toEqual([]);
  expect(await guest.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(browserErrors).toEqual([]);
  await hostContext.close();
  await guestContext.close();
});

test('@claim:paid-license fabricated, revoked, and unavailable verdicts keep paid puzzles closed', async ({ browser }) => {
  for (const token of ['forged-client-verdict', 'revoked-family-license', 'unavailable-cached-license']) {
    const hostContext = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: { 'x-forwarded-for': '203.0.113.74, 10.0.0.4' } });
    await hostContext.addInitScript(({ cachedToken, cachedVerdict }) => {
      localStorage.setItem('kindred:onboarded', 'yes');
      localStorage.setItem('sb_license:kindred-coop', cachedToken);
      localStorage.setItem('sb_license_verdict:kindred-coop', cachedVerdict);
    }, { cachedToken: token, cachedVerdict: JSON.stringify({ token, valid: true, checkedAt: Date.now() }) });
    const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: { 'x-forwarded-for': '203.0.113.75, 10.0.0.4' } });
    await guestContext.addInitScript(() => localStorage.setItem('kindred:onboarded', 'yes'));
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();

    await host.goto('/demo');
    await host.getByRole('link', { name: 'Start for real' }).click();
    await host.getByRole('button', { name: 'Create invite link' }).click();
    await expect(host.getByRole('heading', { name: 'Match four shapes' })).toBeVisible();
    const code = new URL(host.url()).searchParams.get('room');
    await guest.goto(`/?join=${code}`);
    await expect(guest.getByRole('heading', { name: 'Match four shapes' })).toBeVisible();
    await expect(host.getByText('Both connected', { exact: true })).toBeVisible();
    await matchSequence(host, guest, ['Moon', 'Leaf', 'Star', 'Ripple']);
    await host.getByRole('button', { name: 'Start the next puzzle' }).click();
    await expect(host.getByRole('heading', { name: 'The free puzzle is complete' })).toBeVisible();
    await expect(guest.getByRole('heading', { name: 'Waiting for the host' })).toBeVisible();

    await hostContext.close();
    await guestContext.close();
  }
});

test('shows a useful invalid-room state', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': '192.0.2.103, 10.0.0.4' });
  await page.addInitScript(() => localStorage.setItem('kindred:onboarded', 'yes'));
  await page.goto('/?join=NOTREAL');
  await expect(page.locator('.play-start .form-status')).toContainText('not found');
});

test('mobile navigation targets meet the 44 pixel contract', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': '192.0.2.115, 10.0.0.4' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('kindred:onboarded', 'yes'));
  await page.goto('/');
  const undersized = await page.locator('.site-header a, footer a, .skip-link').evaluateAll((elements) => elements
    .filter((element) => getComputedStyle(element).display !== 'none')
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return { text: element.textContent?.trim(), width: rect.width, height: rect.height };
    })
    .filter((rect) => rect.width < 44 || rect.height < 44));
  expect(undersized).toEqual([]);
});

test('desktop keyboard path exposes visible focus and opens a room', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': '192.0.2.129, 10.0.0.4' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => localStorage.setItem('kindred:onboarded', 'yes'));
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to game' })).toBeFocused();
  const outline = await page.getByRole('link', { name: 'Skip to game' }).evaluate((element) => getComputedStyle(element).outlineWidth);
  expect(outline).toBe('3px');
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
  await page.getByRole('button', { name: 'Create invite link' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Match four shapes' })).toBeVisible();
});

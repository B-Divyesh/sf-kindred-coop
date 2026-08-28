import { test, expect, type Page } from 'playwright/test';
import AxeBuilder from '@axe-core/playwright';

const verdict = JSON.stringify({ token: 'valid-family-license', valid: true, checkedAt: Date.now() });

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
    localStorage.setItem('sb_license:kindred-coop', 'valid-family-license');
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
  await expect(host.getByRole('progressbar', { name: 'Moonbeam message progress' })).toBeVisible();
  for (const activePage of [host, guest]) {
    const activeA11y = await new AxeBuilder({ page: activePage }).analyze();
    expect(activeA11y.violations.filter((item) => ['serious', 'critical'].includes(item.impact || ''))).toEqual([]);
  }
  await matchSequence(host, guest, ['Moon', 'Leaf', 'Star', 'Ripple']);

  await host.getByRole('button', { name: 'Open the next field note' }).click();
  await expect(guest.getByRole('heading', { name: 'Stepping-stone trail' })).toBeVisible();
  for (const direction of ['Right', 'Down', 'Right', 'Up']) {
    await host.getByRole('button', { name: `Send ${direction}` }).click();
    await guest.keyboard.press(`Arrow${direction}`);
  }
  await expect(host.getByRole('heading', { name: 'Signal found!' })).toBeVisible();

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

test('fabricated, revoked, and unavailable cached verdicts cannot unlock paid puzzles', async ({ browser }) => {
  for (const token of ['forged-client-verdict', 'revoked-family-license', 'unavailable-cached-license']) {
    const hostContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await hostContext.addInitScript(({ cachedToken, cachedVerdict }) => {
      localStorage.setItem('kindred:onboarded', 'yes');
      localStorage.setItem('sb_license:kindred-coop', cachedToken);
      localStorage.setItem('sb_license_verdict:kindred-coop', cachedVerdict);
    }, { cachedToken: token, cachedVerdict: JSON.stringify({ token, valid: true, checkedAt: Date.now() }) });
    const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await guestContext.addInitScript(() => localStorage.setItem('kindred:onboarded', 'yes'));
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();

    await host.goto('/');
    await host.getByRole('button', { name: 'Create invite link' }).click();
    await expect(host.getByRole('heading', { name: 'Moonbeam message' })).toBeVisible();
    const code = new URL(host.url()).searchParams.get('room');
    await guest.goto(`/?join=${code}`);
    await expect(guest.getByRole('heading', { name: 'Moonbeam message' })).toBeVisible();
    await expect(host.getByText('Together', { exact: true })).toBeVisible();
    await matchSequence(host, guest, ['Moon', 'Leaf', 'Star', 'Ripple']);
    await host.getByRole('button', { name: 'Open the next field note' }).click();
    await expect(host.getByRole('heading', { name: 'The free field note is complete' })).toBeVisible();
    await expect(guest.getByRole('heading', { name: 'Waiting for Lantern' })).toBeVisible();

    await hostContext.close();
    await guestContext.close();
  }
});

test('shows useful invalid-room and offline states', async ({ page, context }) => {
  await page.addInitScript(() => localStorage.setItem('kindred:onboarded', 'yes'));
  await page.goto('/?join=NOTREAL');
  await expect(page.locator('.play-start .form-status')).toContainText('not found');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Two places/);
  await expect(page.locator('.play-start .form-status')).toContainText(/Offline|out of reach/);
});

test('mobile navigation targets meet the 44 pixel contract', async ({ page }) => {
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
  await expect(page.getByRole('heading', { name: 'Moonbeam message' })).toBeVisible();
});

import { test, expect } from 'playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('@claim:sample-demo completes and resets isolated sample data', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    extraHTTPHeaders: { 'x-forwarded-for': '198.51.100.4, 10.0.0.4' },
  });
  await context.addInitScript(() => {
    localStorage.setItem('sb_license:kindred-coop', 'real-license-sentinel');
    sessionStorage.setItem('kindred:REAL123:host', 'real-room-sentinel');
  });
  const requests: string[] = [];
  context.on('request', request => requests.push(request.url()));
  const page = await context.newPage();

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Play picture puzzles together');
  await page.getByRole('link', { name: 'Try it with sample data' }).click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.getByText('Demo — sample data, nothing is saved', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Try a two-player picture puzzle');
  await expect(page.getByText('2 of 4 shapes matched')).toBeVisible();
  await expect(page.getByText('Moon matched')).toBeVisible();
  await expect(page.getByText('Leaf matched')).toBeVisible();

  await page.getByRole('button', { name: 'Match Moon sample signal' }).click();
  await expect(page.getByText('That shape did not match. Start again with Moon.')).toBeVisible();
  await expect(page.getByText(/0 of 4 shapes matched/)).toBeVisible();
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await page.getByRole('button', { name: 'Match Star sample signal' }).click();
  await page.getByRole('button', { name: 'Send Ripple sample signal' }).click();
  await page.getByRole('button', { name: 'Match Ripple sample signal' }).click();
  await expect(page.getByRole('heading', { name: 'Sample puzzle complete' })).toBeVisible();

  await page.getByRole('button', { name: 'Reset demo' }).click();
  await expect(page.getByText('2 of 4 shapes matched')).toBeVisible();
  const stored = await page.evaluate(() => ({
    license: localStorage.getItem('sb_license:kindred-coop'),
    room: sessionStorage.getItem('kindred:REAL123:host'),
    demo: sessionStorage.getItem('demo:kindred-coop'),
  }));
  expect(stored.license).toBe('real-license-sentinel');
  expect(stored.room).toBe('real-room-sentinel');
  expect(stored.demo).toContain('moon');
  expect(requests.filter(url => url.includes('/api/sessions'))).toEqual([]);

  await page.getByRole('link', { name: 'Start for real' }).click();
  await expect(page).toHaveURL(/\/#play$/);
  expect(await page.evaluate(() => sessionStorage.getItem('demo:kindred-coop'))).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem('kindred:REAL123:host'))).toBe('real-room-sentinel');
  await context.close();
});

test('@claim:private-play sample works without accounts, ads, or third-party requests', async ({ browser }) => {
  const context = await browser.newContext({
    extraHTTPHeaders: { 'x-forwarded-for': '198.51.100.52, 10.0.0.4' },
  });
  const requests: string[] = [];
  context.on('request', request => requests.push(request.url()));
  const page = await context.newPage();
  await page.goto('/demo');
  await page.getByRole('button', { name: 'Match Star sample signal' }).click();
  await expect(page.getByText('3 of 4 shapes matched')).toBeVisible();
  expect(await page.locator('input[type="password"], iframe, [class*="ad-"]').count()).toBe(0);
  expect(requests.every(url => new URL(url).origin === 'http://127.0.0.1:8080')).toBe(true);
  expect(requests.some(url => url.includes('/api/page-view') || url.includes('/api/sessions'))).toBe(false);
  const storageKeys = await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) }));
  expect(storageKeys.local).toEqual([]);
  expect(storageKeys.session).toEqual(['demo:kindred-coop']);
  await context.close();
});

test('@claim:offline-instructions reloads the demo offline after a first visit', async ({ browser }) => {
  const context = await browser.newContext({
    extraHTTPHeaders: { 'x-forwarded-for': '198.51.100.69, 10.0.0.4' },
  });
  const page = await context.newPage();
  await page.goto('/demo');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Try a two-player picture puzzle');
  await expect(page.getByText('Demo — sample data, nothing is saved', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Start for real' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Play picture puzzles together');
  await expect(page.locator('.play-start .form-status')).toHaveText('Offline');
  await context.close();
});

test('@claim:temporary-rooms offers fixed timers and lets the host end a room', async ({ browser }) => {
  const context = await browser.newContext({
    extraHTTPHeaders: { 'x-forwarded-for': '198.51.100.86, 10.0.0.4' },
  });
  const page = await context.newPage();
  await page.goto('/demo');
  await page.getByRole('link', { name: 'Start for real' }).click();
  await expect(page.locator('#expiry option')).toHaveText(['15 minutes', '30 minutes', '1 hour']);

  for (const expiryMinutes of [15, 30, 60]) {
    const before = Math.floor(Date.now() / 1000);
    const response = await page.request.post('/api/sessions', { data: { expiryMinutes } });
    expect(response.ok()).toBe(true);
    const credentials = await response.json() as { expiresAt: number };
    expect(credentials.expiresAt).toBeGreaterThanOrEqual(before + expiryMinutes * 60 - 2);
    expect(credentials.expiresAt).toBeLessThanOrEqual(before + expiryMinutes * 60 + 2);
  }

  await page.getByRole('button', { name: 'Create invite link' }).click();
  await expect(page.getByRole('heading', { name: 'Match four shapes' })).toBeVisible();
  await page.getByText('Room controls').click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'End room now' }).click();
  await expect(page.getByRole('heading', { name: 'This room has ended' })).toBeVisible();
  await context.close();
});

test('@claim:rate-limit returns retry guidance after the 40-request allowance', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': '192.0.2.108, 10.0.0.4' });
  await page.goto('/demo');
  const responses = await Promise.all(Array.from({ length: 45 }, () => page.request.post('/api/page-view', {
    headers: { 'x-forwarded-for': '198.51.100.203, 10.0.0.4' },
  })));
  expect(responses.filter(response => response.status() === 204)).toHaveLength(40);
  const limited = responses.filter(response => response.status() === 429);
  expect(limited).toHaveLength(5);
  expect(limited.every(response => response.headers()['retry-after'] === '1')).toBe(true);
});

test('@claim:aggregate-page-count sends one same-origin count and sets no cookie', async ({ context, page }) => {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': '192.0.2.119, 10.0.0.4' });
  const apiRequests: string[] = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url());
  });
  await page.goto('/');
  await expect.poll(() => apiRequests).toHaveLength(1);
  expect(new URL(apiRequests[0]).pathname).toBe('/api/page-view');
  expect(await context.cookies()).toEqual([]);
});

test('route titles, 404 response, demo accessibility, and reduced motion are complete', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': '192.0.2.130, 10.0.0.4' });
  for (const [path, title, heading] of [
    ['/', 'Kindred Co-op — play picture puzzles together', 'Play picture puzzles together'],
    ['/demo', 'Demo — Kindred Co-op', 'Try a two-player picture puzzle'],
    ['/privacy', 'Privacy — Kindred Co-op', 'How Kindred Co-op handles data'],
    ['/terms', 'Terms — Kindred Co-op', 'Terms for using Kindred Co-op'],
  ]) {
    await page.goto(path);
    await expect(page).toHaveTitle(title);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
    await expect(page.locator('main')).toHaveCount(1);
  }
  const missing = await page.goto('/missing-page');
  expect(missing?.status()).toBe(404);
  await expect(page).toHaveTitle('Page not found — Kindred Co-op');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/demo');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const undersized = await page.locator('a, button, input, select, summary').evaluateAll(elements => elements
    .filter(element => getComputedStyle(element).display !== 'none')
    .map(element => {
      const rect = element.getBoundingClientRect();
      return { name: element.textContent?.trim(), width: rect.width, height: rect.height };
    })
    .filter(rect => rect.width < 44 || rect.height < 44));
  expect(undersized).toEqual([]);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(item => ['serious', 'critical'].includes(item.impact || ''))).toEqual([]);
});

test('cold phone and desktop screens show the job, audience, and sample action', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': '192.0.2.141, 10.0.0.4' });
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Play picture puzzles together');
    await expect(page.getByText(/For a parent and child playing apart/)).toBeVisible();
    const action = page.getByRole('link', { name: 'Try it with sample data' });
    await expect(action).toBeVisible();
    const box = await action.boundingBox();
    expect(box && box.y + box.height <= viewport.height).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
});

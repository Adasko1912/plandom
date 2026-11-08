import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'allow' });

test('PlanDom is installable and opens offline after the first visit', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Installability and offline service workers are checked in Chromium (Android Chrome).');
  await page.goto('/');
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifestHref).toBeTruthy();
  const manifestUrl = new URL(manifestHref!, page.url()).href;
  const manifest = await (await page.request.get(manifestUrl)).json();
  expect(manifest).toMatchObject({ short_name: 'PlanDom', display: 'standalone', start_url: './', scope: './', lang: 'pl' });
  const sizes = manifest.icons.map((i: { sizes: string; purpose: string }) => `${i.sizes}/${i.purpose}`);
  expect(sizes).toEqual(expect.arrayContaining(['192x192/any', '512x512/any', '512x512/maskable']));
  for (const icon of manifest.icons) {
    const response = await page.request.get(new URL(icon.src, manifestUrl).href);
    expect(response.ok(), icon.src).toBe(true);
  }
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#1e293b');

  // The worker installs, takes control and keeps the shell for offline use.
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.goto('/editor');
  await expect(page.getByRole('button', { name: /^Draw Wall/ })).toBeVisible({ timeout: 30_000 });

  // A fresh tab without network is served by the worker. (Playwright's page.reload()
  // bypasses service workers, so the check opens pages instead.)
  await context.setOffline(true);
  const offline = await context.newPage();
  const response = await offline.goto('/editor');
  expect(response?.fromServiceWorker()).toBe(true);
  await expect(offline.getByRole('button', { name: /^Draw Wall/ })).toBeVisible({ timeout: 30_000 });
  await offline.goto('/');
  await expect(offline).toHaveTitle(/PlanDom/);
  await context.setOffline(false);
});

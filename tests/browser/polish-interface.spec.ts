import { expect, test, type Locator } from '@playwright/test';
import { en } from '../../src/lib/i18n/locales/en';

// Values from the English dictionary. Whole-word matching avoids false positives
// for shared fragments in Polish words (e.g. "Plan" in "PlanDom").
const englishLabels = [
  en['settings.title'], en['saveControls.save'], en['projectToolbar.undo'], en['projectToolbar.redo'],
  en['layers.walls'], en['layers.doors'], en['layers.windows'], en['layers.furniture'],
  en['exportMenu.title'], en['print.sheetUntitled'], en['settings.tabProject'], en['settings.tabAppearance'],
  en['settings.tabDimensions'], en['settings.language'], en['settings.theme'], en['settings.themeLight'],
  en['settings.themeDark'], en['settings.themeSystem'], en['buildTools.build'], en['buildTools.rooms'],
  en['buildTools.objects'], en['buildTools.tools'], en['buildTools.select'], en['buildTools.structure'],
  en['buildTools.stairs'], en['buildTools.annotate'], en['buildTools.measure'], en['buildTools.import'],
  en['layers.title'], en['openingProperties.height'], en['openingProperties.width'], en['wallProperties.thickness'],
];

async function expectNoEnglish(scope: Locator) {
  await expect(scope).toBeVisible();
  for (const label of englishLabels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await expect(scope).not.toContainText(new RegExp(`\\b${escaped}\\b`));
  }
}

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem('hasSeenWelcome', 'true'));
  // These UI checks need only the locally served production artifact.
  await context.route(/^https?:\/\//, route => {
    const url = new URL(route.request().url());
    return url.hostname === '127.0.0.1' || url.hostname === 'localhost' ? route.continue() : route.abort();
  });
});

test('saved Polish choice localizes the library, editor, sidebar and settings', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('o3d_locale', 'pl'));
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
  await expect(page).toHaveTitle('PlanDom');
  await expect(page.getByRole('button', { name: 'Nowy projekt', exact: true })).toBeVisible();
  await expect(page.getByText('Edytor rzutów', { exact: true })).toBeVisible();

  await page.goto('/editor');
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
  await expect(page).toHaveTitle('PlanDom');
  const save = page.getByRole('button', { name: 'Zapisz', exact: true });
  await expect(save).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cofnij', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ponów', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '2D', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '3D', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Projekt bez nazwy', exact: true })).toBeVisible();
  const toolbar = save.locator('..');
  await expectNoEnglish(toolbar);

  const sidebar = page.getByRole('button', { name: 'Buduj', exact: true }).locator('../..');
  for (const tab of ['Buduj', 'Pomieszczenia', 'Obiekty']) {
    await sidebar.getByRole('button', { name: tab, exact: true }).click();
    await expectNoEnglish(sidebar);
  }
  await sidebar.getByPlaceholder('Szukaj mebli…').fill('lozko');
  await expect(sidebar.getByText('Łóżko dwuosobowe', { exact: true })).toBeVisible();
  await expect(sidebar.getByText('Łóżko jednoosobowe', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Ustawienia', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Ustawienia', exact: true });
  await expect(settings).toBeVisible();
  for (const tab of ['Projekt', 'Wymiary', 'Wygląd']) {
    await settings.getByRole('button', { name: tab, exact: true }).click();
    await expectNoEnglish(settings);
  }
  const language = settings.getByRole('combobox', { name: 'Język', exact: true });
  await expect(language).toHaveValue('pl');
  await expect(language.locator('option').first()).toHaveText('Polski');
  await expect(language.locator('option').first()).toHaveAttribute('lang', 'pl');
  await page.keyboard.press('Escape');
  await save.click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Ustawienia', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
});

test.describe('browser preference without a saved choice', () => {
  test.use({ locale: 'pl-PL' });
  for (const path of ['/', '/editor']) {
    test(`detects Polish on ${path} after hydration`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
      await expect(page.getByRole('button', {
        name: path === '/' ? 'Nowy projekt' : 'Ustawienia', exact: true,
      })).toBeVisible();
      expect(await page.evaluate(() => localStorage.getItem('o3d_locale'))).toBe('pl');
      if (path === '/editor') await expect(page.getByRole('button', { name: 'Projekt bez nazwy', exact: true })).toBeVisible();
    });
  }
  test('saved English wins over Polish browser preference', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('o3d_locale', 'en'));
    await page.goto('/editor');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
  });
});

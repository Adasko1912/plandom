import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function exportJSON(page: Page) {
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download JSON', exact: true }).click();
  return JSON.parse(await readFile((await (await download).path())!, 'utf8'));
}

// 2 × 2 dark grey PNG standing in for a product photo.
const PHOTO = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGM0MjJiYGBgYmBgYGBgAAAKEgGBJgFJ9wAAAABJRU5ErkJggg==', 'base64');

test('a manufacturer product is added, applied to a wall and shown in 3D', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('hasSeenWelcome', 'true'));
  await page.goto('/editor');

  await page.getByRole('button', { name: /^My materials and products/ }).click();
  const dialog = page.getByRole('dialog', { name: 'My materials and products' });
  await expect(dialog.getByText(/No materials yet/)).toBeVisible();
  await dialog.getByRole('button', { name: '+ Add a material' }).click();
  await dialog.getByRole('textbox', { name: 'Name' }).fill('Carbon panel graphite');
  await dialog.getByRole('textbox', { name: 'Manufacturer' }).fill('Example Panels');
  const link = dialog.getByRole('textbox', { name: 'Link to the product page' });
  await link.fill('javascript:alert(1)');
  await expect(dialog.getByRole('alert')).toHaveText('Enter a web address starting with https://');
  await expect(dialog.getByRole('button', { name: 'Save material' })).toBeDisabled();
  await link.fill('sklep.example.pl/plyta-weglowa');
  await dialog.locator('input[type=file]').setInputFiles({ name: 'panel.png', mimeType: 'image/png', buffer: PHOTO });
  await expect(dialog.getByRole('button', { name: 'Change photo' })).toBeVisible();
  await expect(dialog.getByRole('spinbutton', { name: 'Piece width (cm)' })).toHaveValue('60');
  await dialog.getByRole('spinbutton', { name: 'Price (PLN)' }).fill('189.90');
  await dialog.getByRole('combobox', { name: 'per' }).selectOption('piece');
  await dialog.getByRole('button', { name: 'Save material' }).click();
  const item = dialog.getByRole('list', { name: 'Materials in this project' }).getByRole('listitem');
  await expect(item).toContainText('Carbon panel graphite');
  await expect(item).toContainText('Example Panels · 60×120 cm');
  await expect(item.getByRole('link', { name: 'Open sklep.example.pl' })).toHaveAttribute('href', 'https://sklep.example.pl/plyta-weglowa');
  await expect(item.getByRole('link')).toHaveAttribute('rel', 'noopener noreferrer nofollow');
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();

  // Draw a wall, select it and apply the material to its interior side.
  await page.getByRole('button', { name: /^Draw Wall/ }).click();
  const canvas = page.locator('canvas[aria-label]').first();
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.4);
  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.4);
  await canvas.press('Escape');
  await page.getByRole('button', { name: /^Select/ }).first().click();
  // Drawing fits the view to the new wall, which then sits in the middle of the canvas.
  const fitted = (await canvas.boundingBox())!;
  await page.mouse.click(fitted.x + fitted.width / 2, fitted.y + fitted.height / 2);
  const mine = page.getByRole('group', { name: 'My materials' });
  await mine.getByRole('button', { name: 'Carbon panel graphite' }).click();
  await expect(mine.getByRole('button', { name: 'Carbon panel graphite' })).toHaveAttribute('aria-pressed', 'true');
  await expect(mine.getByRole('link', { name: 'product page' })).toBeVisible();

  const saved = await exportJSON(page);
  const id = saved.customMaterials[0].id;
  expect(saved.customMaterials[0]).toMatchObject({ name: 'Carbon panel graphite', productUrl: 'https://sklep.example.pl/plyta-weglowa', price: { amount: 189.9, unit: 'piece' } });
  expect(saved.customMaterials[0].textureDataUrl).toMatch(/^data:image\/jpeg;base64,/);
  expect(saved.floors[0].walls[0].interiorTexture).toBe(`custom:${id}`);

  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect(page.locator('canvas').last()).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(1000);
  expect(errors).toEqual([]);
});

import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

async function exportJSON(page: Page) {
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download JSON', exact: true }).click();
  return JSON.parse(await readFile((await (await download).path())!, 'utf8'));
}

const PRODUCT_FILE = gzipSync([
  JSON.stringify({ format: 'plandom-products', version: 1, shops: [{ name: 'Example Shop', url: 'https://shop.example.pl/' }] }),
  '0\tcorner_medium\tNarożnik Żółty Test\tnaroznik-zolty',
  '0\tfloor:tile\tGres Test 60 x 60\tgres-test',
  '',
].join('\n'));

test('a product is found in a private file, sized by hand and added to the project', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('hasSeenWelcome', 'true'));
  await page.goto('/editor');

  await page.getByRole('button', { name: /^Store products/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Store products' });
  const add = dialog.getByRole('button', { name: 'Add to project' });
  await expect(add).toBeDisabled();

  await dialog.locator('input[type=file]').setInputFiles({ name: 'wrong.gz', mimeType: 'application/gzip', buffer: Buffer.from('nope') });
  await expect(dialog.getByRole('alert')).toHaveText('This is not a PlanDom product file.');

  await dialog.locator('input[type=file]').setInputFiles({ name: 'produkty.txt.gz', mimeType: 'application/gzip', buffer: PRODUCT_FILE });
  await expect(dialog.getByText('Products in your file: 2')).toBeVisible();
  await dialog.getByRole('searchbox', { name: 'Search products' }).fill('zolty');
  const results = dialog.getByRole('list', { name: 'Search results' }).getByRole('button');
  await expect(results).toHaveCount(1);
  await results.click();
  await expect(dialog.getByRole('textbox', { name: 'Link to the product' })).toHaveValue('https://shop.example.pl/naroznik-zolty');
  await expect(add).toBeDisabled();
  await dialog.getByRole('spinbutton', { name: 'Width (cm)' }).fill('270');
  await dialog.getByRole('spinbutton', { name: 'Depth (cm)' }).fill('190');
  await dialog.getByRole('spinbutton', { name: 'Height (cm)' }).fill('85');
  await add.click();
  await expect(dialog.getByRole('status')).toContainText('Narożnik Żółty Test');

  // Any shop can be added from a link, without the file.
  await dialog.getByRole('textbox', { name: 'Product name' }).fill('Gres OBI');
  await dialog.getByRole('textbox', { name: 'Link to the product' }).fill('www.obi.pl/p/1/gres żółty');
  await dialog.getByRole('combobox', { name: 'Shape or finish' }).selectOption('floor:tile');
  await dialog.getByRole('spinbutton', { name: 'Piece width (cm)' }).fill('60');
  await dialog.getByRole('spinbutton', { name: /Piece (height|length)/ }).fill('120');
  await add.click();
  await expect(dialog.getByRole('status')).toContainText('Gres OBI');
  await dialog.getByRole('button', { name: 'Close' }).click();

  const project = await exportJSON(page);
  expect(project.floors[0].furniture[0]).toMatchObject({ catalogId: 'corner_medium', width: 270, depth: 190, height: 85 });
  expect(project.floors[0].furniture[0].details.note).toContain('https://shop.example.pl/naroznik-zolty');
  expect(project.customMaterials[0]).toMatchObject({ name: 'Gres OBI', use: 'floor', category: 'tile', tileWidth: 60, tileHeight: 120, productUrl: 'https://www.obi.pl/p/1/gres%20%C5%BC%C3%B3%C5%82ty' });
  expect(errors).toEqual([]);

  // The file is remembered by this browser only.
  await page.reload();
  await page.getByRole('button', { name: /^Store products/ }).click();
  await expect(page.getByRole('dialog', { name: 'Store products' }).getByText('Products in your file: 2')).toBeVisible();
});

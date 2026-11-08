import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { jsPDF } from 'jspdf';

async function exportJSON(page: Page) {
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download JSON', exact: true }).click();
  return JSON.parse(await readFile((await (await download).path())!, 'utf8'));
}

/** Two-page A4 landscape PDF; page 2 holds a 100 × 50 mm rectangle, i.e. 10 × 5 m at 1:100. */
function samplePdf(): Buffer {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.text('Strona tytulowa', 20, 20);
  doc.addPage('a4', 'landscape');
  doc.setLineWidth(1);
  doc.rect(50, 50, 100, 50);
  doc.text('Rzut parteru 1:100', 50, 40);
  return Buffer.from(doc.output('arraybuffer'));
}

// 8 × 8 white PNG.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAD0lEQVR4nGP4jwMwDC0JALoev0Ewkwr8AAAAAElFTkSuQmCC', 'base64');

// 1 × 1 red PNG; photos are stored by content hash, so a second photo must differ.
const PNG_RED = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==', 'base64');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('hasSeenWelcome', 'true'));
});

test('a PDF house design is placed at its drawing scale', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/editor');
  await page.getByRole('button', { name: /^House design \(PDF or drawing\)/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Add a house design' });
  await dialog.locator('input[type=file]').setInputFiles({ name: 'projekt.pdf', mimeType: 'application/pdf', buffer: samplePdf() });
  const pageSelect = dialog.getByRole('combobox', { name: 'Page with the floor plan' });
  await expect(pageSelect.locator('option')).toHaveText(['Page 1 of 2', 'Page 2 of 2'], { timeout: 30_000 });
  await pageSelect.selectOption({ label: 'Page 2 of 2' });
  await expect(dialog.getByRole('img', { name: 'Preview of the chosen page' })).toBeVisible();
  await expect(dialog.getByRole('radio', { name: '1:100' })).toBeChecked();

  await dialog.getByRole('radio', { name: 'Other:' }).check();
  await dialog.getByRole('textbox', { name: 'Other:' }).fill('1:abc');
  await expect(dialog.getByRole('button', { name: 'Place under the plan' })).toBeDisabled();
  await dialog.getByRole('radio', { name: '1:50' }).check();
  await dialog.getByRole('button', { name: 'Place under the plan' }).click();
  await expect(dialog).toHaveCount(0);

  const saved = await exportJSON(page);
  const bg = saved.floors[0].backgroundImage;
  expect(bg.dataUrl).toMatch(/^data:image\/(png|jpeg);base64,/);
  // A4 renders at 200 DPI: 1 px = 0.127 mm of paper = 0.635 cm at 1:50.
  expect(bg.scale).toBeCloseTo(0.635, 4);
  const width = await page.evaluate(async url => { const i = new Image(); i.src = url; await i.decode(); return i.naturalWidth; }, bg.dataUrl);
  // 297 mm of paper at 1:50 is 14.85 m.
  expect(width * bg.scale).toBeCloseTo(1485, -1);
  expect(errors).toEqual([]);
});

test('a picture of the plan is calibrated by two clicks', async ({ page }) => {
  await page.goto('/editor');
  await page.getByRole('button', { name: /^House design \(PDF or drawing\)/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Add a house design' });
  await dialog.locator('input[type=file]').setInputFiles({ name: 'rzut.png', mimeType: 'image/png', buffer: PNG });
  await expect(dialog.getByRole('radio', { name: 'I will set the scale on the drawing' })).toBeChecked();
  await expect(dialog.getByRole('radio', { name: '1:100' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Place under the plan' }).click();

  const hint = page.getByRole('status').filter({ hasText: 'Click the first end of a known dimension' });
  await expect(hint).toBeVisible();
  const canvas = page.locator('canvas[aria-label]').first();
  const box = (await canvas.boundingBox())!;
  page.once('dialog', d => d.accept('500'));
  await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.5);
  await expect(page.getByRole('status').filter({ hasText: 'Click the second end' })).toBeVisible();
  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.5);
  await expect(page.getByRole('status').filter({ hasText: /Click the (first|second) end/ })).toHaveCount(0);
  const saved = await exportJSON(page);
  expect(saved.floors[0].backgroundImage.scale).not.toBe(1);
  expect(saved.floors[0].walls).toHaveLength(0);
});

test('a room is built from typed dimensions with its photos attached', async ({ page }) => {
  await page.goto('/editor');
  await page.getByRole('button', { name: /^Room from dimensions and photos/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Room from dimensions and photos' });
  await expect(dialog.getByRole('radio', { name: /I will type them/ })).toHaveAttribute('aria-checked', 'true');
  await dialog.locator('input[type=file]').setInputFiles([{ name: 'a.png', mimeType: 'image/png', buffer: PNG }, { name: 'b.png', mimeType: 'image/png', buffer: PNG_RED }]);
  await expect(dialog.getByRole('heading', { name: 'Photos: 2' })).toBeVisible();
  await dialog.getByRole('textbox', { name: 'Room name' }).fill('Gabinet');
  await dialog.getByRole('combobox', { name: 'Room type' }).selectOption('office');
  const create = dialog.getByRole('button', { name: 'Create room' });
  await dialog.getByRole('spinbutton', { name: 'Length (cm)' }).fill('360');
  await expect(create).toBeDisabled();
  await dialog.getByRole('spinbutton', { name: 'Width (cm)' }).fill('290');
  await dialog.getByRole('spinbutton', { name: 'Ceiling height (cm)' }).fill('265');
  await dialog.getByRole('combobox', { name: 'Walls' }).selectOption({ label: 'Partition 12 cm' });
  await expect(dialog.getByText('Floor area: 10.44 m²')).toBeVisible();
  await create.click();
  await expect(dialog).toHaveCount(0);

  const saved = await exportJSON(page);
  const floor = saved.floors[0];
  expect(floor.walls).toHaveLength(4);
  expect(floor.walls.every((w: { thickness: number; height: number }) => w.thickness === 12 && w.height === 265)).toBe(true);
  const room = floor.rooms.find((r: { name: string }) => r.name === 'Gabinet');
  expect(room).toBeTruthy();
  expect(room.details).toMatchObject({ roomType: 'office', ceilingHeight: 265 });
  expect(room.details.photos).toHaveLength(2);
});

test('AI reads room dimensions from photos through the configured provider', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('o3d_openai_settings', JSON.stringify({ apiKey: 'test-key', baseUrl: 'https://vision.provider.test/v1', model: 'vision-test' })));
  const bodies: { model: string; messages: { content: { type: string }[] }[] }[] = [];
  await page.route('https://vision.provider.test/v1/chat/completions', async route => {
    bodies.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ choices: [{ message: { content: '{"roomType":"bedroom","name":"Sypialnia","length":402,"width":338,"height":262,"confidence":"medium","notes":"Drzwi 80 cm jako odniesienie."}' } }] }),
    });
  });
  await page.goto('/editor');
  await page.getByRole('button', { name: /^Room from dimensions and photos/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Room from dimensions and photos' });
  await dialog.getByRole('radio', { name: /Read from photos \(AI\)/ }).click();
  const analyse = dialog.getByRole('button', { name: 'Read the dimensions' });
  await expect(analyse).toBeDisabled();
  await dialog.locator('input[type=file]').setInputFiles({ name: 'room.png', mimeType: 'image/png', buffer: PNG });
  await dialog.getByRole('textbox', { name: /Anything you already know/ }).fill('drzwi 80 cm');
  await analyse.click();
  await expect(dialog.getByRole('status')).toContainText('Fair estimate');
  await expect(dialog.getByRole('status')).toContainText('Drzwi 80 cm jako odniesienie.');
  await expect(dialog.getByRole('spinbutton', { name: 'Length (cm)' })).toHaveValue('400');
  await expect(dialog.getByRole('spinbutton', { name: 'Width (cm)' })).toHaveValue('340');
  await expect(dialog.getByRole('spinbutton', { name: 'Ceiling height (cm)' })).toHaveValue('260');
  await expect(dialog.getByRole('textbox', { name: 'Room name' })).toHaveValue('Sypialnia');
  expect(bodies).toHaveLength(1);
  expect(bodies[0].model).toBe('vision-test');
  expect(bodies[0].messages[0].content.filter(p => p.type === 'image_url')).toHaveLength(1);
  await dialog.getByRole('button', { name: 'Create room' }).click();
  const saved = await exportJSON(page);
  expect(saved.floors[0].rooms.map((r: { name: string }) => r.name)).toContain('Sypialnia');
});

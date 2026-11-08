import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function exportJSON(page: Page, exportLabel: string, downloadLabel: string) {
  await page.getByRole('button', { name: exportLabel, exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: downloadLabel, exact: true }).click();
  const path = await (await download).path();
  expect(path).toBeTruthy();
  return JSON.parse(await readFile(path!, 'utf8'));
}

const canvas = (page: Page) => page.locator('canvas[aria-label]').first();

test.describe('Polish starter templates', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => localStorage.setItem('o3d_locale', 'pl'));
  });

  const templates = [
    { label: 'Mieszkanie M2', floors: ['Mieszkanie'], rooms: [4] },
    { label: 'Mieszkanie M3', floors: ['Mieszkanie'], rooms: [6] },
    { label: 'Dom parterowy', floors: ['Parter'], rooms: [10] },
    { label: 'Dom z poddaszem użytkowym', floors: ['Parter', 'Poddasze'], rooms: [6, 6] },
  ];

  for (const template of templates) {
    test(`${template.label} opens in 2D and 3D`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('/');
      await page.getByRole('button', { name: /Użyj szablonu/ }).click();
      await page.getByRole('button', { name: new RegExp(`^\\S+\\s*${template.label}`) }).click();
      const floor = page.getByRole('combobox', { name: 'Bieżąca kondygnacja' });
      const application = page.getByRole('application');
      await expect(application).toContainText(`Pomieszczenia: ${template.rooms[0]}`);
      if (template.floors.length > 1) {
        await expect(floor.locator('option')).toHaveText(template.floors);
        await floor.selectOption({ label: template.floors[1] });
        await expect(application).toContainText(`Pomieszczenia: ${template.rooms[1]}`);
        await floor.selectOption({ label: template.floors[0] });
      }
      await page.getByRole('button', { name: '3D', exact: true }).click();
      await expect(page.locator('canvas').last()).toBeVisible({ timeout: 60_000 });
      await page.getByRole('button', { name: '2D', exact: true }).click();
      const saved = await exportJSON(page, 'Eksport', 'Pobierz JSON');
      expect(saved.name).toBe(template.label);
      expect(saved.floors.map((f: { name: string }) => f.name)).toEqual(template.floors);
      expect(saved.floors[0].walls.every((w: { height: number }) => w.height === 270)).toBe(true);
      expect(errors).toEqual([]);
    });
  }
});

test('the wall tool draws walls of the chosen type', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('hasSeenWelcome', 'true'));
  await page.goto('/editor');
  const wallTool = page.getByRole('button', { name: /^Draw Wall/ });
  await wallTool.click();
  const presets = page.getByRole('group', { name: 'Wall type', exact: true });
  await expect(presets.getByRole('button', { name: 'Exterior 44 cm', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await presets.getByRole('button', { name: 'Partition 12 cm', exact: true }).click();
  await expect(presets.getByRole('button', { name: 'Partition 12 cm', exact: true })).toHaveAttribute('aria-pressed', 'true');

  const bounds = (await canvas(page).boundingBox())!;
  await page.mouse.click(bounds.x + bounds.width * 0.3, bounds.y + bounds.height * 0.4);
  await page.mouse.click(bounds.x + bounds.width * 0.6, bounds.y + bounds.height * 0.4);
  await canvas(page).press('Escape');
  const saved = await exportJSON(page, 'Export', 'Download JSON');
  expect(saved.floors[0].walls).toHaveLength(1);
  expect(saved.floors[0].walls[0]).toMatchObject({ thickness: 12, height: 270 });

  // The choice survives a reload because it is stored with the other settings.
  await page.reload();
  await page.getByRole('button', { name: /^Draw Wall/ }).click();
  await expect(page.getByRole('group', { name: 'Wall type', exact: true }).getByRole('button', { name: 'Partition 12 cm', exact: true }))
    .toHaveAttribute('aria-pressed', 'true');
});

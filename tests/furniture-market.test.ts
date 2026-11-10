import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { furnitureCatalog, getCatalogItem } from '../src/lib/utils/furnitureCatalog';
import { marketBases, marketFurniture, marketModelFiles } from '../src/lib/utils/furnitureCatalogMarket';
import { furnitureName } from '../src/lib/i18n/furnitureNames';
import { catalogCategoryLabels } from '../src/lib/i18n/catalogCategories';
import { floorTextureFiles, wallTextureFiles } from '../src/lib/utils/textureFiles';
import { floorMaterials, wallColors } from '../src/lib/utils/materials';
import { floorMaterialLabels } from '../src/lib/i18n/roomPropertyLabels';
import { wallMaterialLabels } from '../src/lib/i18n/wallMaterialLabels';

describe('market furniture', () => {
  it('has unique ids that do not change existing items', () => {
    const ids = furnitureCatalog.map(item => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(getCatalogItem('sofa')).toMatchObject({ width: 200, depth: 90 });
  });

  it('offers real sofa choices', () => {
    for (const id of ['sofa_2', 'sofa_3', 'sofa_4', 'corner_small', 'corner_medium', 'corner_large', 'corner_u']) {
      expect(getCatalogItem(id)?.category).toBe('Living Room');
    }
  });

  it.each(marketFurniture.map(item => [item.id, item] as const))('%s is usable', (id, item) => {
    expect(Math.min(item.width, item.depth, item.height)).toBeGreaterThan(0);
    expect(catalogCategoryLabels[item.category]).toBeTruthy();
    expect(furnitureName(id, 'pl').trim()).not.toBe('');
    expect(furnitureName(id, 'pt').trim()).not.toBe('');
    const file = marketModelFiles[id];
    if (file) expect(existsSync(`static/models/${file}.glb`), `${file}.glb`).toBe(true);
    const base = marketBases[id];
    expect(['sofa_corner', 'sofa_u'].includes(base) || getCatalogItem(base)).toBeTruthy();
  });

  it('keeps wall-hung units off the floor', () => {
    expect(getCatalogItem('kitchen_upper_60')?.mountHeight).toBe(145);
    expect(getCatalogItem('kitchen_base_60')?.mountHeight).toBeUndefined();
  });
});

describe('finishes', () => {
  it('every floor and wall texture has a file', () => {
    for (const file of [...Object.values(floorTextureFiles), ...Object.values(wallTextureFiles)]) {
      expect(existsSync(`static/textures/${file}`), file).toBe(true);
    }
  });

  it('every finish has a label and a texture', () => {
    for (const material of floorMaterials.filter(m => m.id !== 'none')) {
      expect(floorMaterialLabels[material.id], material.id).toBeTruthy();
      expect(floorTextureFiles[material.id], material.id).toBeTruthy();
    }
    for (const wall of wallColors.filter(w => w.texture)) {
      expect(wallMaterialLabels[wall.id], wall.id).toBeTruthy();
      expect(wallTextureFiles[wall.id], wall.id).toBeTruthy();
    }
  });

  it('keeps textured finishes out of the paint colours', () => {
    expect(wallColors.find(w => w.id === 'white-brick')?.finishOnly).toBe(true);
    expect(wallColors.find(w => w.id === 'white')?.finishOnly).toBeUndefined();
  });
});

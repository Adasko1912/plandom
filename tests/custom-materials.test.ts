import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import type { CustomMaterial } from '$lib/models/types';
import { addWall, createDefaultProject, currentProject, removeCustomMaterial, saveCustomMaterial, undo } from '$lib/stores/project';
import { averageColor, materialQuantity, productHost, safeProductUrl, supportsUse, validateCustomMaterial } from '$lib/utils/customMaterials';
import { customMaterialKey, onCustomMaterialChange, registeredCustomMaterial } from '$lib/utils/customMaterialRegistry';
import { getMaterial } from '$lib/utils/materials';
import { readProject } from '$lib/utils/projectValidation';

const carbon = (over: Partial<CustomMaterial> = {}): CustomMaterial => ({
  id: 'carbon1', name: 'Płyta węglowa grafit', manufacturer: 'Producent', productUrl: 'https://sklep.example.pl/plyta-weglowa',
  category: 'panel', use: 'wall', color: '#333333', tileWidth: 60, tileHeight: 120,
  textureDataUrl: 'data:image/jpeg;base64,AAAA', price: { amount: 189.9, unit: 'piece' }, ...over,
});

describe('product links', () => {
  it('keeps plain http(s) links and adds https to bare addresses', () => {
    expect(safeProductUrl('https://sklep.example.pl/p?id=5')).toBe('https://sklep.example.pl/p?id=5');
    expect(safeProductUrl('  sklep.example.pl/plyty  ')).toBe('https://sklep.example.pl/plyty');
    expect(productHost('https://www.sklep.example.pl/a')).toBe('sklep.example.pl');
  });
  it('rejects scripts, credentials and non-web schemes', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'https://user:pass@example.pl', 'ftp://example.pl/a', 'localhost', `https://e.pl/${'a'.repeat(1001)}`]) {
      expect(safeProductUrl(bad)).toBeNull();
    }
    expect(safeProductUrl('')).toBeNull();
  });
});

describe('material validation', () => {
  it('accepts a complete product and a paint without photo', () => {
    expect(() => validateCustomMaterial(carbon())).not.toThrow();
    expect(() => validateCustomMaterial(carbon({ category: 'paint', textureDataUrl: undefined, price: { amount: 79, unit: 'litre' }, coverage: 10 }))).not.toThrow();
  });
  it.each([
    ['name', { name: ' ' }],
    ['color', { color: 'red' }],
    ['tileWidth', { tileWidth: 0 }],
    ['productUrl', { productUrl: 'javascript:alert(1)' }],
    ['textureDataUrl', { textureDataUrl: 'https://example.pl/x.jpg' }],
    ['price', { price: { amount: -1, unit: 'm2' } }],
    ['category', { category: 'lava' }],
    ['coverage', { coverage: 0 }],
  ])('rejects a bad %s', (field, over) => {
    expect(() => validateCustomMaterial(carbon(over as Partial<CustomMaterial>))).toThrow(new RegExp(field));
  });
  it('checks project files, including duplicate ids', () => {
    const project = createDefaultProject('M');
    expect(readProject({ ...project, customMaterials: [carbon()] }).customMaterials).toHaveLength(1);
    expect(() => readProject({ ...project, customMaterials: [carbon(), carbon()] })).toThrow(/duplicates/);
    expect(() => readProject({ ...project, customMaterials: [carbon({ productUrl: 'javascript:x' })] })).toThrow(/productUrl/);
  });
  it('knows which surfaces a material fits', () => {
    expect(supportsUse({ use: 'both' }, 'floor')).toBe(true);
    expect(supportsUse({ use: 'wall' }, 'floor')).toBe(false);
  });
});

describe('colour and quantities', () => {
  it('averages opaque pixels only', () => {
    expect(averageColor(new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255, 9, 9, 9, 0]))).toBe('#800080');
    expect(averageColor(new Uint8ClampedArray([1, 2, 3, 0]))).toBe('#cccccc');
  });
  it('counts pieces with 10 % waste: 12 m² of 60×120 panels', () => {
    // 12 × 1.1 = 13.2 m² / 0.72 m² = 18.33 → 19 pieces × 189.90 = 3608.10
    expect(materialQuantity(carbon(), 12)).toEqual({ area: 13.2, units: 19, cost: 3608.1 });
  });
  it('prices per m², per package and per litre', () => {
    expect(materialQuantity(carbon({ price: { amount: 100, unit: 'm2' } }), 10)).toMatchObject({ units: null, cost: 1100 });
    // 20 × 1.1 = 22 m² / 2.16 m² per package = 10.19 → 11 packages
    expect(materialQuantity(carbon({ category: 'flooring', price: { amount: 120, unit: 'package' }, coverage: 2.16 }), 20)).toMatchObject({ units: 11, cost: 1320 });
    // Paint has no waste: 30 m² / 10 m² per litre = 3 litres
    expect(materialQuantity(carbon({ category: 'paint', price: { amount: 50, unit: 'litre' }, coverage: 10 }), 30)).toEqual({ area: 30, units: 3, cost: 150 });
    expect(materialQuantity(carbon({ price: { amount: 50, unit: 'package' }, coverage: undefined }), 5).cost).toBeNull();
    expect(materialQuantity(carbon({ price: undefined }), 5).cost).toBeNull();
  });
});

describe('project materials', () => {
  beforeEach(() => currentProject.set(createDefaultProject('Materials')));

  it('registers saved materials for textures and colour lookups', () => {
    const changed = vi.fn();
    const stop = onCustomMaterialChange(changed);
    saveCustomMaterial(carbon());
    const key = customMaterialKey('carbon1');
    expect(registeredCustomMaterial(key)).toMatchObject({ name: 'Płyta węglowa grafit', tileWidth: 60 });
    expect(getMaterial(key)).toMatchObject({ color: '#333333' });
    saveCustomMaterial(carbon({ tileWidth: 30 }));
    expect(get(currentProject)!.customMaterials).toHaveLength(1);
    expect(changed).toHaveBeenLastCalledWith([key]);
    stop();
  });

  it('removing a material keeps its colour on the walls and floors that used it, and undo restores it', () => {
    saveCustomMaterial(carbon({ use: 'both' }));
    const key = customMaterialKey('carbon1');
    addWall({ x: 0, y: 0 }, { x: 300, y: 0 });
    currentProject.update(p => {
      const floor = p!.floors[0];
      floor.walls[0].interiorTexture = key;
      floor.rooms.push({ id: 'r1', name: 'Salon', walls: [floor.walls[0].id], floorTexture: key, area: 0 });
      return p;
    });
    removeCustomMaterial('carbon1');
    const floor = get(currentProject)!.floors[0];
    expect(floor.walls[0]).toMatchObject({ interiorTexture: 'none', interiorColor: '#333333' });
    expect(floor.rooms[0]).toMatchObject({ floorTexture: 'none', color: '#333333' });
    expect(get(currentProject)!.customMaterials).toEqual([]);
    expect(registeredCustomMaterial(key)).toBeUndefined();
    undo();
    expect(get(currentProject)!.customMaterials).toHaveLength(1);
  });
});

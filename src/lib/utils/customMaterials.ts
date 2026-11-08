import type { CustomMaterial, CustomMaterialCategory, CustomMaterialPriceUnit, CustomMaterialUse, Project } from '$lib/models/types';
import { registerCustomMaterials } from './customMaterialRegistry';

export const MATERIAL_CATEGORIES: CustomMaterialCategory[] = ['panel', 'tile', 'wallpaper', 'paint', 'flooring', 'other'];
export const MATERIAL_USES: CustomMaterialUse[] = ['wall', 'floor', 'both'];
export const PRICE_UNITS: CustomMaterialPriceUnit[] = ['m2', 'piece', 'package', 'litre'];
export const MATERIAL_PHOTO_SIDE = 1024;
export const MATERIAL_PHOTO_FILE_LIMIT = 15 * 1024 * 1024;
export const MAX_CUSTOM_MATERIALS = 200;

/** Sensible piece sizes (cm) per category, used to prefill the form. */
export const CATEGORY_DEFAULT_SIZE: Record<CustomMaterialCategory, [number, number]> = {
  panel: [60, 120], tile: [60, 60], wallpaper: [53, 64], paint: [100, 100], flooring: [20, 120], other: [100, 100],
};

const HEX = /^#[0-9a-f]{6}$/i;

/** Accepts only plain http(s) links without credentials; returns the normalised URL or null. */
export function safeProductUrl(value: string | undefined | null): string | null {
  const input = value?.trim();
  if (!input) return null;
  let url: URL;
  try { url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(input) ? input : `https://${input}`); } catch { return null; }
  if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.username || url.password || !url.hostname.includes('.')) return null;
  const href = url.href;
  return href.length <= 1000 ? href : null;
}

/** Host shown next to a product, e.g. "sklep.producent.pl". */
export function productHost(value: string | undefined): string | null {
  try { return value ? new URL(value).hostname.replace(/^www\./, '') : null; } catch { return null; }
}

export function supportsUse(material: Pick<CustomMaterial, 'use'>, surface: 'wall' | 'floor'): boolean {
  return material.use === 'both' || material.use === surface;
}

/** Throws a readable error for anything a project file must not contain. */
export function validateCustomMaterial(value: unknown, path = 'customMaterial'): asserts value is CustomMaterial {
  const fail = (field: string, reason: string): never => { throw new Error(`Invalid project: ${path}.${field} ${reason}.`); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('', 'must be an object');
  const m = value as Record<string, unknown>;
  const text = (key: string, max: number, required = false) => {
    const v = m[key];
    if (v === undefined && !required) return;
    if (typeof v !== 'string' || v.length > max || (required && !v.trim())) fail(key, required ? 'must be nonempty text' : 'must be text');
  };
  text('id', 100, true); text('name', 120, true); text('manufacturer', 120); text('notes', 2000);
  if (!MATERIAL_CATEGORIES.includes(m.category as CustomMaterialCategory)) fail('category', 'is unknown');
  if (!MATERIAL_USES.includes(m.use as CustomMaterialUse)) fail('use', 'is unknown');
  if (typeof m.color !== 'string' || !HEX.test(m.color)) fail('color', 'must be a #rrggbb colour');
  for (const key of ['tileWidth', 'tileHeight']) {
    const v = m[key];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 1 || v > 1000) fail(key, 'must be 1–1000 cm');
  }
  if (m.productUrl !== undefined && safeProductUrl(m.productUrl as string) !== m.productUrl) fail('productUrl', 'must be an http(s) link');
  if (m.textureDataUrl !== undefined && (typeof m.textureDataUrl !== 'string' || !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(m.textureDataUrl) || m.textureDataUrl.length > 4_000_000)) {
    fail('textureDataUrl', 'must be an embedded JPEG, PNG or WebP image');
  }
  if (m.price !== undefined) {
    const p = m.price as Record<string, unknown>;
    if (!p || typeof p !== 'object' || typeof p.amount !== 'number' || !Number.isFinite(p.amount) || p.amount < 0 || p.amount > 1_000_000
      || !PRICE_UNITS.includes(p.unit as CustomMaterialPriceUnit)) fail('price', 'must have an amount and a known unit');
  }
  if (m.coverage !== undefined && (typeof m.coverage !== 'number' || !Number.isFinite(m.coverage) || m.coverage <= 0 || m.coverage > 10_000)) fail('coverage', 'must be a positive area');
}

/** Average of opaque pixels as #rrggbb; used as the 2D colour and while the texture loads. */
export function averageColor(data: Uint8ClampedArray): string {
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
  }
  if (!n) return '#cccccc';
  const hex = (v: number) => Math.round(v / n).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/** Downscales a photo to at most 1024 px JPEG and measures its average colour. */
export async function prepareMaterialPhoto(file: File): Promise<{ dataUrl: string; color: string }> {
  if (!file.size || file.size > MATERIAL_PHOTO_FILE_LIMIT) throw new Error('size');
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('type');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40_000_000) throw new Error('pixels');
    const scale = Math.min(1, MATERIAL_PHOTO_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('canvas');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const color = averageColor(context.getImageData(0, 0, canvas.width, canvas.height).data);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    if (!dataUrl.startsWith('data:image/jpeg;base64,')) throw new Error('encode');
    return { dataUrl, color };
  } finally { URL.revokeObjectURL(url); }
}

export interface MaterialQuantity {
  /** Area to cover including the waste allowance (m²). */
  area: number;
  /** Units to buy in the price unit (pieces, packages or litres); null for m² pricing without packages. */
  units: number | null;
  cost: number | null;
}

/**
 * How much to buy for `netArea` m². Pieces are counted from their size, packages and
 * litres from `coverage`. 10 % waste for pieces and tiles, none for paint.
 */
export function materialQuantity(material: Pick<CustomMaterial, 'category' | 'tileWidth' | 'tileHeight' | 'price' | 'coverage'>, netArea: number): MaterialQuantity {
  const waste = material.category === 'paint' ? 0 : 0.1;
  const area = Math.round(Math.max(0, netArea) * (1 + waste) * 1e4) / 1e4;
  const unit = material.price?.unit;
  let units: number | null = null;
  if (unit === 'piece') units = Math.ceil(area / (material.tileWidth * material.tileHeight / 10_000) - 1e-9);
  else if ((unit === 'package' || unit === 'litre') && material.coverage) units = Math.ceil(area / material.coverage - 1e-9);
  const cost = !material.price ? null : unit === 'm2' ? area * material.price.amount : units === null ? null : units * material.price.amount;
  return { area, units, cost: cost === null ? null : Math.round(cost * 100) / 100 };
}

/** Keeps the texture registry in step with the open project. */
export function syncCustomMaterials(project: Project | null | undefined): void {
  registerCustomMaterials((project?.customMaterials ?? []).map(m => ({
    id: m.id, name: m.name, color: m.color, textureDataUrl: m.textureDataUrl, tileWidth: m.tileWidth, tileHeight: m.tileHeight,
  })));
}

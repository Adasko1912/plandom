import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { ProductFileError, parseProductCatalog, productPosition, readProductFile } from '../src/lib/utils/productCatalog';

const header = JSON.stringify({ format: 'plandom-products', version: 1, shops: [{ name: 'Shop A', url: 'https://a.example.pl/' }, { name: 'Shop B', url: 'https://b.example.pl/' }] });
const rows = [
  '0\tsofa\tSofa Łódź zielona\tsofa-lodz',
  '1\tcorner_medium\tNarożnik szary Żółw\tnaroznik-zolw',
  '1\tfloor:tile\tGres szary 60 x 60\tgres-60',
  '0\tsofa\tSofa szara\tsofa-szara',
];
const encode = (lines: string[]) => new TextEncoder().encode(lines.join('\n') + '\n');
const parse = (lines: string[] = rows) => parseProductCatalog(encode([header, ...lines]));
const problem = (promise: Promise<unknown>) => promise.then(() => 'none', e => e instanceof ProductFileError ? e.problem : `other: ${e}`);

describe('product file', () => {
  it('finds products regardless of Polish letters and word order', async () => {
    const catalog = await parse();
    expect(catalog.size).toBe(4);
    expect(catalog.search({ query: 'LODZ sofa' }).hits.map(h => h.name)).toEqual(['Sofa Łódź zielona']);
    expect(catalog.search({ query: 'zółw' }).hits[0]).toMatchObject({ shop: 'Shop B', kind: 'corner_medium', url: 'https://b.example.pl/naroznik-zolw' });
  });

  it('filters by shop and kind, also without a query', async () => {
    const catalog = await parse();
    expect(catalog.search({ query: 'szar', shop: 'Shop B' }).hits.map(h => h.name)).toEqual(['Narożnik szary Żółw', 'Gres szary 60 x 60']);
    expect(catalog.search({ query: '', kind: 'floor:tile' }).hits.map(h => h.url)).toEqual(['https://b.example.pl/gres-60']);
  });

  it('matches every row once and reports further results', async () => {
    const catalog = await parse();
    expect(catalog.search({ query: 'szar' }).hits).toHaveLength(3);
    expect(catalog.search({ query: 'a' }, 2)).toMatchObject({ more: true, hits: [{ index: 0 }, { index: 1 }] });
    expect(catalog.search({ query: 'sofa szara' }, 1)).toMatchObject({ more: false });
  });

  it('skips broken rows and keeps the good ones', async () => {
    const catalog = await parse(['9\tsofa\tUnknown shop\tx', '0\tspaceship\tUnknown kind\tx', '0\tsofa\t \tx', 'x\tsofa\tBad\tx', 'too\tfew', ...rows.slice(0, 1)]);
    expect(catalog.size).toBe(1);
    expect(catalog.search({ query: '' }).hits[0].name).toBe('Sofa Łódź zielona');
  });

  it('reads gzip files and refuses other input', async () => {
    const good = gzipSync(encode([header, ...rows]));
    expect((await readProductFile(new Blob([good]))).size).toBe(4);
    expect(await problem(readProductFile(new Blob(['plain text'])))).toBe('format');
    expect(await problem(readProductFile(new Blob([])))).toBe('size');
    expect(await problem(readProductFile(new Blob([gzipSync(encode(['{"format":"other"}', ...rows]))])))).toBe('format');
    expect(await problem(readProductFile(new Blob([gzipSync(encode([header, 'too\tfew']))])))).toBe('empty');
    const javascriptShop = JSON.stringify({ format: 'plandom-products', version: 1, shops: [{ name: 'X', url: 'javascript:alert(1)//' }] });
    expect(await problem(readProductFile(new Blob([gzipSync(encode([javascriptShop, ...rows]))])))).toBe('format');
  });
});

describe('product placement', () => {
  it('uses the middle of the walls and separates consecutive items', () => {
    const walls = [{ start: { x: 0, y: 0 }, end: { x: 1000, y: 0 } }, { start: { x: 1000, y: 0 }, end: { x: 1000, y: 600 } }];
    expect(productPosition(walls, 0)).toEqual({ x: 500, y: 300 });
    expect(productPosition(walls, 2)).toEqual({ x: 560, y: 360 });
    expect(productPosition([], 0)).toEqual({ x: 0, y: 0 });
  });
});

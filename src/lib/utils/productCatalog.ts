// A private product list that the user loads from their own computer. It is never bundled with
// the app or uploaded: shops' data must not end up on the public site.
import { writable } from 'svelte/store';
import type { Point } from '$lib/models/types';

export const PRODUCT_KINDS = [
  'imported_object', 'sofa', 'loveseat', 'corner_medium', 'corner_u', 'chair', 'wardrobe', 'dresser', 'bookshelf',
  'dining_table', 'desk', 'bed_queen', 'counter', 'bathtub', 'shower',
  'floor:tile', 'floor:flooring', 'wall:wallpaper', 'wall:panel', 'wall:paint',
] as const;
export type ProductKind = typeof PRODUCT_KINDS[number];

export interface ProductHit { index: number; shop: string; kind: ProductKind; name: string; url: string }
export interface ProductQuery { query: string; shop?: string; kind?: string }

export type ProductFileProblem = 'size' | 'format' | 'empty';
export class ProductFileError extends Error {
  constructor(readonly problem: ProductFileProblem) { super(`Product file rejected: ${problem}`); }
}

const MAX_FILE_BYTES = 64 * 1024 * 1024;
const MAX_TEXT_BYTES = 400 * 1024 * 1024;
const MAX_ROWS = 2_000_000;
const MAX_LINE_BYTES = 4000;
const NEWLINE = 10;
const kindIndex = new Map<string, number>(PRODUCT_KINDS.map((kind, i) => [kind, i]));

export const foldText = (text: string) => text.toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/\p{M}/gu, '');

/** Rows live in the decompressed bytes and are decoded only when shown, which keeps phones within memory. */
export class ProductCatalog {
  private readonly decoder = new TextDecoder();

  constructor(
    private readonly bytes: Uint8Array,
    private readonly starts: Uint32Array,
    private readonly lengths: Uint16Array,
    private readonly shopOf: Uint8Array,
    private readonly kindOf: Uint8Array,
    private readonly corpus: string,
    private readonly corpusStarts: Uint32Array,
    readonly shops: { name: string; url: string }[],
    readonly size: number,
  ) {}

  private rowAt(position: number): number {
    let low = 0, high = this.size - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (this.corpusStarts[middle] <= position) low = middle; else high = middle - 1;
    }
    return low;
  }

  private hit(index: number): ProductHit {
    const fields = this.decoder.decode(this.bytes.subarray(this.starts[index], this.starts[index] + this.lengths[index])).split('\t');
    const shop = this.shops[this.shopOf[index]];
    return { index, shop: shop.name, kind: PRODUCT_KINDS[this.kindOf[index]], name: fields[2], url: shop.url + fields[3] };
  }

  search({ query, shop, kind }: ProductQuery, limit = 100): { hits: ProductHit[]; more: boolean } {
    const words = foldText(query).split(/\s+/).filter(Boolean);
    const shopIndex = shop ? this.shops.findIndex(s => s.name === shop) : -1;
    const wantedKind = kind ? kindIndex.get(kind) ?? -1 : -1;
    const fits = (row: number) => (shopIndex < 0 || this.shopOf[row] === shopIndex) && (wantedKind < 0 || this.kindOf[row] === wantedKind);
    const found: number[] = [];
    if (!words.length) {
      for (let row = 0; row < this.size && found.length <= limit; row++) if (fits(row)) found.push(row);
    } else {
      // The longest word occurs least often, so it decides which lines are examined.
      const key = words.reduce((a, b) => b.length > a.length ? b : a);
      for (let at = this.corpus.indexOf(key); at >= 0 && found.length <= limit; at = this.corpus.indexOf(key, at)) {
        const row = this.rowAt(at);
        const end = row + 1 < this.size ? this.corpusStarts[row + 1] - 1 : this.corpus.length;
        if (fits(row)) {
          const line = this.corpus.slice(this.corpusStarts[row], end);
          if (words.every(word => line.includes(word))) found.push(row);
        }
        at = end + 1;
      }
    }
    return { hits: found.slice(0, limit).map(row => this.hit(row)), more: found.length > limit };
  }
}

function readHeader(text: string): { name: string; url: string }[] {
  let header: any;
  try { header = JSON.parse(text); } catch { throw new ProductFileError('format'); }
  const valid = header?.format === 'plandom-products' && header.version === 1 && Array.isArray(header.shops)
    && header.shops.length > 0 && header.shops.length <= 200
    && header.shops.every((s: any) => typeof s?.name === 'string' && s.name.length <= 80 && typeof s.url === 'string' && /^https?:\/\/[^/\s]+\/$/.test(s.url));
  if (!valid) throw new ProductFileError('format');
  return header.shops;
}

/** Parses decompressed text: a JSON header line, then shop, kind, name and link suffix separated by tabs. */
export async function parseProductCatalog(bytes: Uint8Array): Promise<ProductCatalog> {
  const decoder = new TextDecoder();
  const headerEnd = bytes.indexOf(NEWLINE);
  if (headerEnd < 0 || headerEnd > 100_000) throw new ProductFileError('format');
  const shops = readHeader(decoder.decode(bytes.subarray(0, headerEnd)));

  let lines = 0;
  for (let i = headerEnd; i < bytes.length; i++) if (bytes[i] === NEWLINE) lines++;
  if (lines > MAX_ROWS) throw new ProductFileError('size');
  const starts = new Uint32Array(lines), lengths = new Uint16Array(lines), shopOf = new Uint8Array(lines), kindOf = new Uint8Array(lines);
  const corpusStarts = new Uint32Array(lines), folded: string[] = [];
  let size = 0, corpusLength = 0;
  for (let start = headerEnd + 1, line = 0; start < bytes.length; line++) {
    let end = bytes.indexOf(NEWLINE, start);
    if (end < 0) end = bytes.length;
    if (end - start <= MAX_LINE_BYTES) {
      const fields = decoder.decode(bytes.subarray(start, end)).split('\t');
      const shop = /^\d{1,3}$/.test(fields[0] ?? '') ? Number(fields[0]) : -1, kind = kindIndex.get(fields[1] ?? '');
      if (fields.length === 4 && shops[shop] && kind !== undefined && fields[2].trim() && fields[3]) {
        const name = foldText(fields[2]);
        starts[size] = start; lengths[size] = end - start; shopOf[size] = shop; kindOf[size] = kind;
        corpusStarts[size] = corpusLength; corpusLength += name.length + 1;
        folded.push(name); size++;
      }
    }
    start = end + 1;
    if (line % 25_000 === 24_999) await new Promise(resolve => setTimeout(resolve)); // keep the page responsive
  }
  if (!size) throw new ProductFileError('empty');
  return new ProductCatalog(bytes, starts, lengths, shopOf, kindOf, folded.join('\n'), corpusStarts, shops, size);
}

/** Reads a gzip product file, refusing anything that would expand beyond what a browser can hold. */
export async function readProductFile(file: Blob): Promise<ProductCatalog> {
  if (!file.size || file.size > MAX_FILE_BYTES) throw new ProductFileError('size');
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = file.stream().pipeThrough(new DecompressionStream('gzip')).getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_TEXT_BYTES) throw new ProductFileError('size');
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error instanceof ProductFileError ? error : new ProductFileError('format');
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return parseProductCatalog(bytes);
}

const DATABASE = 'plandom-products', STORE = 'files', KEY = 'catalog';

function withStore<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DATABASE, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result, transaction = db.transaction(STORE, mode), request = action(transaction.objectStore(STORE));
      transaction.oncomplete = () => { db.close(); resolve(request.result); };
      transaction.onerror = transaction.onabort = () => { db.close(); reject(transaction.error); };
    };
  });
}

/** Safari's engine can refuse a file picked from disk, so the bytes are kept instead. */
export async function storeProductFile(file: Blob) {
  const bytes = await file.arrayBuffer();
  return withStore('readwrite', store => store.put(bytes, KEY));
}

export async function loadStoredProductFile() {
  const stored = await withStore<ArrayBuffer | undefined>('readonly', store => store.get(KEY));
  return stored && new Blob([stored]);
}

export const removeStoredProductFile = () => withStore('readwrite', store => store.delete(KEY));

export const productCatalog = writable<ProductCatalog | null>(null);

/** Middle of the walls, nudged per item so that consecutive products stay separately selectable. */
export function productPosition(walls: { start: Point; end: Point }[], itemCount: number): Point {
  const points = walls.flatMap(wall => [wall.start, wall.end]);
  const middle = (values: number[]) => values.length ? (Math.min(...values) + Math.max(...values)) / 2 : 0; // an empty plan opens centred on the origin
  const nudge = (itemCount % 8) * 30;
  return { x: middle(points.map(p => p.x)) + nudge, y: middle(points.map(p => p.y)) + nudge };
}

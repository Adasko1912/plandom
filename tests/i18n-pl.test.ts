import { afterEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { initializeLocale, intlLocale, locale, t, translate, type Locale, type TranslationKey } from '../src/lib/i18n';
import { en } from '../src/lib/i18n/locales/en';
import { pl } from '../src/lib/i18n/locales/pl';
import { normalizeCatalogSearch } from '../src/lib/i18n/catalogCategories';
import { furnitureName, polishFurnitureNames, portugueseFurnitureNames, customModelName } from '../src/lib/i18n/furnitureNames';
import { projectServiceMessage } from '../src/lib/i18n/projectServiceMessages';
import { createDefaultFloor, createDefaultProject } from '../src/lib/stores/project';

afterEach(() => { vi.unstubAllGlobals(); locale.set('en'); });

const keys = Object.keys(en) as TranslationKey[];
const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();

describe('complete Polish dictionary', () => {
  it('has exactly the English keys and no empty values', () => {
    expect(Object.keys(pl).sort()).toEqual([...keys].sort());
    for (const key of keys) expect(pl[key].trim(), key).not.toBe('');
  });

  it('preserves every placeholder name and occurrence, allowing Polish word order', () => {
    for (const key of keys) expect(placeholders(pl[key]), key).toEqual(placeholders(en[key]));
  });

  it('reports identical values and rejects more than 3% untranslated text', () => {
    const pureUnitsOrFormats = /^(?:(?:cm|m|m²|ft|inch|mm|MiB|MB|PDF|DXF|DWG|GLB|JSON|ZIP|SVG|PNG|JPEG|JPG|GIF|WebP|Letter|A[0-5]|2D|3D)[\s,/]*)+$/;
    const eligible = keys.filter(key => !pureUnitsOrFormats.test(en[key]) && /[\p{L}]/u.test(en[key]));
    const identical = eligible.filter(key => pl[key] === en[key]);
    console.info(`Polish: ${keys.length} keys; ${keys.filter(key => pl[key] === en[key]).length} identical total; excluding pure units/formats/symbols: ${identical.length}/${eligible.length} (${(100 * identical.length / eligible.length).toFixed(2)}%).`, identical);
    expect(identical.length / eligible.length).toBeLessThanOrEqual(0.03);
  });

  it('substitutes variables once and retains user-authored braces', () => {
    expect(translate('pl', 'floors.elevation', { name: 'Moje {value} piętro' })).toBe('Poziom kondygnacji Moje {value} piętro (cm)');
    expect(translate('pl', 'customModel.dimensions', { width: 80, depth: 60, height: 75 })).toBe('Szerokość 80 × głębokość 60 × wysokość 75 cm');
    expect(translate('pl', 'library.countMany', { count: 22 })).toBe('Projekty: 22');
  });

  it.each([0, 2, 5, 12, 22, 101])('uses count-neutral plural labels for %i', count => {
    expect(translate('pl', 'canvasStatus.wallsMany', { count })).toBe(`Ściany: ${count}`);
    expect(translate('pl', 'canvasStatus.objectsMany', { count })).toBe(`Obiekty: ${count}`);
  });
});

function browser(languages: string[] | undefined, saved: string | null = null, language = 'en-US') {
  vi.stubGlobal('navigator', { languages, language });
  vi.stubGlobal('document', { documentElement: { lang: 'en' } });
  const storage = { getItem: vi.fn(() => saved), setItem: vi.fn() };
  vi.stubGlobal('localStorage', storage);
  return storage;
}

describe('Polish locale initialization and formatting', () => {
  it('chooses Polish after hydration for pl-PL and persists it', () => {
    const storage = browser(['pl-PL']);
    expect(get(locale)).toBe('en');
    initializeLocale();
    expect(get(locale)).toBe('pl');
    expect(get(t)('settings.title')).toBe('Ustawienia');
    expect(document.documentElement.lang).toBe('pl');
    expect(storage.setItem).toHaveBeenCalledWith('o3d_locale', 'pl');
  });
  it.each<Locale>(['en', 'pt', 'pl'])('honors saved %s over browser preferences', saved => {
    browser(['pl-PL'], saved);
    initializeLocale();
    expect(get(locale)).toBe(saved);
  });
  it('checks every browser language', () => {
    browser(['de-DE', 'en-US', 'pl']);
    initializeLocale();
    expect(get(locale)).toBe('pl');
  });
  it.each([undefined, []])('falls back to navigator.language when languages is %j', languages => {
    browser(languages, null, 'pl-PL');
    initializeLocale();
    expect(get(locale)).toBe('pl');
  });
  it('defaults to English for non-Polish browsers and ignores invalid saved values', () => {
    browser(['pt-BR'], 'fr');
    initializeLocale();
    expect(get(locale)).toBe('en');
  });
  it('detects Polish when browser storage is blocked', () => {
    browser(['pl-PL']);
    vi.stubGlobal('localStorage', { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } });
    expect(() => initializeLocale()).not.toThrow();
    expect(get(locale)).toBe('pl');
  });
  it('is safe without browser globals', () => {
    vi.stubGlobal('navigator', undefined);
    vi.stubGlobal('localStorage', undefined);
    vi.stubGlobal('document', undefined);
    expect(() => initializeLocale()).not.toThrow();
    expect(get(locale)).toBe('en');
  });
  it('maps all three Intl locales and supports Polish dates and numbers', () => {
    expect(['en', 'pt', 'pl'].map(value => intlLocale(value as Locale))).toEqual(['en', 'pt-BR', 'pl-PL']);
    expect(new Intl.NumberFormat(intlLocale('pl')).format(1.5)).toBe('1,5');
    expect(new Intl.DateTimeFormat(intlLocale('pl'), { month: 'long', timeZone: 'UTC' }).format(new Date('2026-11-08T12:00:00Z'))).toBe('listopad');
  });
});

describe('Polish helper integration', () => {
  it('covers every Portuguese furniture ID', () => {
    expect(Object.keys(polishFurnitureNames).sort()).toEqual(Object.keys(portugueseFurnitureNames).sort());
    for (const name of Object.values(polishFurnitureNames)) expect(name.trim()).not.toBe('');
  });
  it('translates furniture and preserves unknown IDs', () => {
    expect(furnitureName('bed_queen', 'pl')).toBe('Łóżko dwuosobowe');
    expect(furnitureName('chair', 'pl')).toBe('Fotel');
    expect(furnitureName('wardrobe', 'pl')).toBe('Szafa');
    expect(furnitureName('sym_outlet', 'pl')).toBe('Gniazdo elektryczne');
    expect(furnitureName('unknown-user-id', 'pl')).toBe('unknown-user-id');
    expect(furnitureName('bed_queen', 'pt')).toBe('Cama queen');
  });
  it('normalizes Polish diacritics and retains Portuguese search behavior', () => {
    expect(normalizeCatalogSearch('Łóżko')).toBe('lozko');
    expect(normalizeCatalogSearch('ŁÓŻKO')).toBe('lozko');
    expect(normalizeCatalogSearch('zażółć gęślą jaźń')).toBe('zazolc gesla jazn');
    expect(normalizeCatalogSearch('Sofá')).toBe('sofa');
    expect(normalizeCatalogSearch(furnitureName('bed_queen', 'pl'))).toContain('lozko');
  });
  it('translates service messages with a Polish outcome and upstream branding', () => {
    expect(projectServiceMessage(`${en['projectService.fileFailed']} ${pl['welcome.noImport']}`, 'pl')).toBe(`${pl['projectService.fileFailed']} ${pl['welcome.noImport']}`);
    expect(projectServiceMessage('Close other OpenPlan3D tabs, then retry loading to update browser storage. Your saved projects have not been removed.', 'pl')).toBe(pl['projectService.upgradeBlocked']);
    expect(pl['projectService.packageManifest']).toContain('PlanDom/OpenPlan3D');
  });
  it('names only new defaults in Polish, preserving authored names and other languages', () => {
    locale.set('pl');
    expect(createDefaultProject().name).toBe('Projekt bez nazwy');
    expect(createDefaultFloor().name).toBe('Parter');
    expect(createDefaultFloor(2).name).toBe('Kondygnacja 2');
    expect(createDefaultProject('My Home').name).toBe('My Home');
    locale.set('pt');
    expect(createDefaultProject().name).toBe('Untitled Project');
    expect(createDefaultFloor().name).toBe('Ground Floor');
    expect(customModelName({ customModelId: 'mine' } as never, { customModels: [{ id: 'mine', name: 'My Chair' }] } as never)).toBe('My Chair');
  });
});

import { derived, writable } from 'svelte/store';
import { en } from './locales/en';
import { pt } from './locales/pt';
import { pl } from './locales/pl';

export type Locale = 'en' | 'pt' | 'pl';
export type TranslationKey = keyof typeof en;
const dictionaries: Record<Locale, Record<TranslationKey, string>> = { en, pt, pl };
const preference = writable<Locale>('en');
const isLocale = (value: unknown): value is Locale => value === 'en' || value === 'pt' || value === 'pl';

export function intlLocale(language: Locale): string {
  return { en: 'en', pt: 'pt-BR', pl: 'pl-PL' }[language];
}

export function translate(language: Locale, key: TranslationKey, variables: Record<string, string | number> = {}): string {
  // Single-pass substitution preserves literal braces in user-provided values.
  return dictionaries[language][key].replace(/\{(\w+)\}/g, (token, name) =>
    Object.hasOwn(variables, name) ? String(variables[name]) : token);
}

export const locale = {
  subscribe: preference.subscribe,
  set(value: Locale) {
    if (!isLocale(value)) return;
    preference.set(value);
    if (typeof document !== 'undefined') document.documentElement.lang = value;
    try { localStorage.setItem('o3d_locale', value); } catch { /* In-memory choice still works. */ }
  },
};

/** Run after hydration; SSR and the first client render always agree on English. */
export function initializeLocale() {
  let saved: unknown;
  try { saved = localStorage.getItem('o3d_locale'); } catch { /* Storage can be disabled. */ }
  // Node also exposes navigator; only use language detection in a browser document.
  const languages = typeof document === 'undefined' || typeof navigator === 'undefined' ? []
    : navigator.languages?.length ? navigator.languages : [navigator.language];
  locale.set(isLocale(saved) ? saved : languages.some(language => language?.toLowerCase().startsWith('pl')) ? 'pl' : 'en');
}

/** Svelte's $t subscription updates labels without remounting dialogs or inputs. */
export const t = derived(preference, (language) =>
  (key: TranslationKey, variables?: Record<string, string | number>) => translate(language, key, variables));

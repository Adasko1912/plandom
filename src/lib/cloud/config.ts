// Supabase connection settings. The URL and the publishable (anon) key are public by design:
// every table is protected by row level security, see supabase/migrations.
// Never put a service_role key here.

export interface CloudConfig { url: string; key: string }

declare global {
  // Browser tests point an unconfigured build at a mocked project before the app starts.
  // Ignored whenever the build has its own settings.
  var __PLANDOM_SUPABASE__: CloudConfig | undefined;
}

const PROJECT_URL = /^https:\/\/[a-z0-9-]+\.supabase\.(?:co|in)$/;

/** Accepts only a Supabase project address and a key that is not a secret service key. */
export function validCloudConfig(url: unknown, key: unknown): CloudConfig | null {
  if (typeof url !== 'string' || typeof key !== 'string') return null;
  const cleanUrl = url.trim().replace(/\/+$/, '');
  const cleanKey = key.trim();
  if (!PROJECT_URL.test(cleanUrl) || cleanKey.length < 20 || cleanKey.length > 2000) return null;
  if (cleanKey.startsWith('sb_secret_') || jwtRole(cleanKey) === 'service_role') return null;
  return { url: cleanUrl, key: cleanKey };
}

function jwtRole(key: string): string | null {
  const parts = key.split('.');
  if (parts.length !== 3) return null;
  try {
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    const role = JSON.parse(json)?.role;
    return typeof role === 'string' ? role : null;
  } catch { return null; }
}

export function cloudConfig(): CloudConfig | null {
  const built = validCloudConfig(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
  if (built) return built;
  const injected = typeof globalThis !== 'undefined' ? globalThis.__PLANDOM_SUPABASE__ : undefined;
  return injected ? validCloudConfig(injected.url, injected.key) : null;
}

export function cloudConfigured(): boolean {
  return cloudConfig() !== null;
}

/** localStorage key of the signed-in session, read without loading the Supabase library. */
export const AUTH_STORAGE_KEY = 'plandom-auth';

export function hasStoredSession(): boolean {
  try { return !!localStorage.getItem(AUTH_STORAGE_KEY); } catch { return false; }
}

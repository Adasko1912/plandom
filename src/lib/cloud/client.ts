import type { SupabaseClient } from '@supabase/supabase-js';
import { AUTH_STORAGE_KEY, cloudConfig } from './config';

let client: Promise<SupabaseClient> | null = null;

export class CloudNotConfiguredError extends Error {
  constructor() { super('not-configured'); }
}

/** Loads the Supabase library only when a page needs the cloud. */
export function getClient(): Promise<SupabaseClient> {
  const config = cloudConfig();
  if (!config) return Promise.reject(new CloudNotConfiguredError());
  client ??= import('@supabase/supabase-js').then(({ createClient }) => createClient(config.url, config.key, {
    auth: {
      storageKey: AUTH_STORAGE_KEY,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  })).catch(error => { client = null; throw error; });
  return client;
}

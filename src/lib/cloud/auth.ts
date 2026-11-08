import { get, writable } from 'svelte/store';
import type { Session } from '@supabase/supabase-js';
import { base } from '$app/paths';
import { getClient } from './client';
import { CloudError } from './errors';

export const session = writable<Session | null>(null);
/** True once the stored session (or the link in the address bar) has been read. */
export const authReady = writable(false);
/** null while unknown. Only decides what the page shows; the database checks again. */
export const isAdmin = writable<boolean | null>(null);
/** Set when the user arrived from a password-reset email. */
export const passwordRecovery = writable(false);

export const MIN_PASSWORD_LENGTH = 8;

let started: Promise<void> | null = null;

export function accountUrl(query = ''): string {
  return `${location.origin}${base}/konto${query}`;
}

/** Reads the session once per page; later calls return the same promise. */
export function initAuth(): Promise<void> {
  started ??= (async () => {
    try {
      const supabase = await getClient();
      supabase.auth.onAuthStateChange((event, next) => {
        if (event === 'PASSWORD_RECOVERY') passwordRecovery.set(true);
        session.set(next);
        if (!next) isAdmin.set(false);
      });
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      session.set(data.session);
      if (data.session) void refreshAdmin(); else isAdmin.set(false);
    } finally {
      authReady.set(true);
      clearAuthParams();
    }
  })().catch(error => { started = null; throw error; });
  return started;
}

/** Removes the one-time code from the address bar so it is not bookmarked or shared. */
function clearAuthParams() {
  const url = new URL(location.href);
  let changed = false;
  for (const key of ['code', 'error', 'error_code', 'error_description']) {
    if (url.searchParams.has(key)) { url.searchParams.delete(key); changed = true; }
  }
  if (changed) history.replaceState(history.state, '', url);
}

export async function refreshAdmin(): Promise<boolean> {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('is_admin');
  const admin = !error && data === true;
  isAdmin.set(admin);
  return admin;
}

export async function signIn(email: string, password: string): Promise<void> {
  const supabase = await getClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
  session.set(data.session);
  await refreshAdmin();
}

/** Returns true when Supabase asks the user to confirm the address first. */
export async function signUp(email: string, password: string): Promise<boolean> {
  if (password.length < MIN_PASSWORD_LENGTH) throw new CloudError('weak-password');
  const supabase = await getClient();
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(), password, options: { emailRedirectTo: accountUrl() },
  });
  if (error) throw error;
  // With confirmation on, an existing address returns a user with no identities and no session.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw new CloudError('user-exists');
  session.set(data.session);
  if (data.session) await refreshAdmin();
  return !data.session;
}

export async function signOut(): Promise<void> {
  const supabase = await getClient();
  const { error } = await supabase.auth.signOut();
  session.set(null);
  isAdmin.set(false);
  if (error && !/session/i.test(error.message)) throw error;
}

export async function requestPasswordReset(email: string): Promise<void> {
  const supabase = await getClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: accountUrl('?reset=1') });
  if (error) throw error;
}

export async function updatePassword(password: string): Promise<void> {
  if (password.length < MIN_PASSWORD_LENGTH) throw new CloudError('weak-password');
  const supabase = await getClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
  passwordRecovery.set(false);
}

export function signedInEmail(): string | null {
  return get(session)?.user.email ?? null;
}

export function requireSession(): Session {
  const current = get(session);
  if (!current) throw new CloudError('not-signed-in');
  return current;
}

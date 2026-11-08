/** Where to go after signing in. Only a few app pages are allowed, never another site. */
export function safeNext(value: string | null | undefined): string {
  if (!value) return '/konto';
  return /^\/(?:editor(?:\?id=[A-Za-z0-9_-]{1,100})?|konto|admin)$/.test(value) ? value : '/konto';
}

import type { TranslationKey } from '$lib/i18n';

export type CloudErrorKind =
  | 'not-configured' | 'network' | 'invalid-credentials' | 'email-not-confirmed' | 'user-exists'
  | 'weak-password' | 'rate-limit' | 'not-signed-in' | 'forbidden' | 'not-found' | 'too-large'
  | 'comments-disabled' | 'too-many-comments' | 'invalid' | 'unknown';

export class CloudError extends Error {
  constructor(readonly kind: CloudErrorKind, message = kind) { super(message); }
}

/** Turns Supabase auth, PostgREST and network failures into a small set of user-facing cases. */
export function cloudErrorKind(error: unknown): CloudErrorKind {
  if (error instanceof CloudError) return error.kind;
  if (!error || typeof error !== 'object') return 'unknown';
  const e = error as { message?: unknown; code?: unknown; status?: unknown; name?: unknown };
  const message = typeof e.message === 'string' ? e.message : '';
  const code = typeof e.code === 'string' ? e.code : '';
  const status = typeof e.status === 'number' ? e.status : 0;
  if (message === 'not-configured') return 'not-configured';
  if (e.name === 'AuthRetryableFetchError' || /Failed to fetch|NetworkError|Load failed|fetch failed/i.test(message)) return 'network';
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(message)) return 'invalid-credentials';
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(message)) return 'email-not-confirmed';
  if (code === 'user_already_exists' || code === 'email_exists' || /already registered/i.test(message)) return 'user-exists';
  if (code === 'weak_password' || /password should be/i.test(message)) return 'weak-password';
  if (code.startsWith('over_') || status === 429 || /rate limit/i.test(message)) return 'rate-limit';
  if (/try again in a minute|too many comments/i.test(message) || code === '54000') return 'too-many-comments';
  if (/comments are disabled/i.test(message)) return 'comments-disabled';
  if (/share not found/i.test(message) || code === 'P0002') return 'not-found';
  if (code === '42501' || /forbidden|permission denied|row-level security/i.test(message)) return 'forbidden';
  if (/projects_data_size/i.test(message) || status === 413) return 'too-large';
  if (code === '23514' || code === '22001' || /violates check/i.test(message)) return 'invalid';
  return 'unknown';
}

export const CLOUD_ERROR_MESSAGES: Record<CloudErrorKind, TranslationKey> = {
  'not-configured': 'cloud.error.notConfigured',
  network: 'cloud.error.network',
  'invalid-credentials': 'cloud.error.invalidCredentials',
  'email-not-confirmed': 'cloud.error.emailNotConfirmed',
  'user-exists': 'cloud.error.userExists',
  'weak-password': 'cloud.error.weakPassword',
  'rate-limit': 'cloud.error.rateLimit',
  'not-signed-in': 'cloud.error.notSignedIn',
  forbidden: 'cloud.error.forbidden',
  'not-found': 'cloud.error.notFound',
  'too-large': 'cloud.error.tooLarge',
  'comments-disabled': 'cloud.error.commentsDisabled',
  'too-many-comments': 'cloud.error.tooManyComments',
  invalid: 'cloud.error.invalid',
  unknown: 'cloud.error.unknown',
};

export function cloudErrorMessage(error: unknown): TranslationKey {
  return CLOUD_ERROR_MESSAGES[cloudErrorKind(error)];
}

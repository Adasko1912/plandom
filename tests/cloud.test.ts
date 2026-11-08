import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '$lib/stores/project';
import { validCloudConfig } from '$lib/cloud/config';
import { CloudError, cloudErrorKind } from '$lib/cloud/errors';
import { safeNext } from '$lib/cloud/navigation';
import { SHARE_DATA_LIMIT, shareableProject, tokenFromHash, validComment } from '$lib/cloud/shares';
import { readProject } from '$lib/utils/projectValidation';

const KEY = 'sb_publishable_' + 'x'.repeat(30);
const jwt = (role: string) => `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ role })).replace(/=+$/, '')}.signature`;

describe('cloud settings', () => {
  it('accepts a Supabase project address and a publishable key', () => {
    expect(validCloudConfig('https://abcd1234.supabase.co/', ` ${KEY} `)).toEqual({ url: 'https://abcd1234.supabase.co', key: KEY });
    expect(validCloudConfig('https://abcd1234.supabase.co', jwt('anon'))).not.toBeNull();
  });
  it('refuses secret keys and other addresses', () => {
    expect(validCloudConfig('https://abcd1234.supabase.co', jwt('service_role'))).toBeNull();
    expect(validCloudConfig('https://abcd1234.supabase.co', 'sb_secret_' + 'x'.repeat(30))).toBeNull();
    expect(validCloudConfig('http://abcd1234.supabase.co', KEY)).toBeNull();
    expect(validCloudConfig('https://evil.example.com', KEY)).toBeNull();
    expect(validCloudConfig('https://abcd1234.supabase.co', 'short')).toBeNull();
    expect(validCloudConfig(undefined, undefined)).toBeNull();
  });
});

describe('errors', () => {
  it.each([
    [{ name: 'AuthApiError', code: 'invalid_credentials', message: 'Invalid login credentials', status: 400 }, 'invalid-credentials'],
    [{ code: 'email_not_confirmed', message: 'Email not confirmed' }, 'email-not-confirmed'],
    [{ code: 'over_email_send_rate_limit', message: 'x', status: 429 }, 'rate-limit'],
    [{ code: 'P0002', message: 'share not found' }, 'not-found'],
    [{ code: '54000', message: 'too many comments, try again in a minute' }, 'too-many-comments'],
    [{ code: '42501', message: 'comments are disabled for this link' }, 'comments-disabled'],
    [{ code: '42501', message: 'forbidden' }, 'forbidden'],
    [{ code: '23514', message: 'new row violates check constraint "projects_data_size"' }, 'too-large'],
    [new TypeError('Failed to fetch'), 'network'],
    [new CloudError('not-signed-in'), 'not-signed-in'],
    [{ message: 'not-configured' }, 'not-configured'],
    [null, 'unknown'],
  ])('maps %o', (error, kind) => {
    expect(cloudErrorKind(error)).toBe(kind);
  });
});

describe('links and navigation', () => {
  it('reads only a 32-character hex token from the address', () => {
    expect(tokenFromHash('#0123456789abcdef0123456789ABCDEF')).toBe('0123456789abcdef0123456789abcdef');
    expect(tokenFromHash('#abc')).toBeNull();
    expect(tokenFromHash('#0123456789abcdef0123456789abcdeg')).toBeNull();
    expect(tokenFromHash('')).toBeNull();
  });
  it('goes back only to app pages after signing in', () => {
    expect(safeNext('/editor?id=abc_12')).toBe('/editor?id=abc_12');
    expect(safeNext('/admin')).toBe('/admin');
    for (const bad of ['//evil.example', 'https://evil.example', '/editor?id=a&x=<script>', 'javascript:alert(1)', null]) {
      expect(safeNext(bad)).toBe('/konto');
    }
  });
  it('checks a comment before sending', () => {
    expect(validComment({ author: 'Anna', body: 'Okno za małe' })).toBe(true);
    expect(validComment({ author: ' ', body: 'x' })).toBe(false);
    expect(validComment({ author: 'A', body: 'x'.repeat(2001) })).toBe(false);
    expect(validComment({ author: 'A', body: 'x', x: 1, y: null })).toBe(false);
    expect(validComment({ author: 'A', body: 'x', x: 1, y: 2 })).toBe(true);
  });
});

describe('shared copy of a project', () => {
  const big = (n: number) => 'data:image/png;base64,' + 'A'.repeat(n);

  it('sends a small project unchanged and leaves the original alone', () => {
    const project = createDefaultProject('Dom');
    const { data, dropped } = shareableProject(project);
    expect(dropped).toEqual([]);
    expect(data).not.toBe(project);
    expect(readProject(data).name).toBe('Dom');
  });

  it('drops tracing images first, then photos and material photos, and stays a valid project', () => {
    const project = createDefaultProject('Dom');
    project.floors[0].backgroundImage = { dataUrl: big(SHARE_DATA_LIMIT), position: { x: 0, y: 0 }, scale: 1, opacity: 0.5, rotation: 0, locked: false };
    let result = shareableProject(project);
    expect(result.dropped).toEqual(['backgrounds']);
    expect(result.data.floors[0].backgroundImage).toBeUndefined();
    expect(project.floors[0].backgroundImage).toBeDefined();

    project.customMaterials = [{ id: 'm1', name: 'Panel', category: 'panel', use: 'wall', color: '#333333', tileWidth: 60, tileHeight: 120, textureDataUrl: 'data:image/jpeg;base64,' + 'A'.repeat(SHARE_DATA_LIMIT) }];
    result = shareableProject(project);
    expect(result.dropped).toEqual(['backgrounds', 'textures']);
    expect(result.data.customMaterials![0]).toMatchObject({ color: '#333333' });
    expect(result.data.customMaterials![0].textureDataUrl).toBeUndefined();
    expect(() => readProject(result.data)).not.toThrow();
  });

  it('refuses a project that is too large even without pictures', () => {
    const project = createDefaultProject('Dom');
    project.description = 'x'.repeat(SHARE_DATA_LIMIT + 10);
    expect(() => shareableProject(project)).toThrow(CloudError);
  });
});

import { base } from '$app/paths';
import type { Project } from '$lib/models/types';
import { readProject } from '$lib/utils/projectValidation';
import { getClient } from './client';
import { requireSession } from './auth';
import { CloudError } from './errors';

/** Stays below the 5 MB `projects_data_size` check with room for JSONB overhead. */
export const SHARE_DATA_LIMIT = 4_000_000;
export const COMMENT_AUTHOR_LIMIT = 80;
export const COMMENT_BODY_LIMIT = 2000;
export const SHARE_LABEL_LIMIT = 100;

export type DroppedPart = 'backgrounds' | 'attachments' | 'textures';

export interface ShareLink {
  token: string;
  label: string | null;
  allow_comments: boolean;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface ShareComment {
  id: string;
  token?: string;
  author_name: string;
  body: string;
  floor_id: string | null;
  x: number | null;
  y: number | null;
  resolved: boolean;
  created_at: string;
}

export interface SharedProject {
  name: string;
  project: Project;
  updatedAt: string;
  allowComments: boolean;
  label: string | null;
}

const size = (value: unknown) => JSON.stringify(value).length;

/**
 * A copy of the project small enough for the review link. Tracing images go first, then
 * photos and imported 3D models (which live in the project package), then material photos.
 * Walls, rooms, furniture and materials' colours always stay.
 */
export function shareableProject(project: Project): { data: Project; dropped: DroppedPart[] } {
  const data = JSON.parse(JSON.stringify(project)) as Project;
  const dropped: DroppedPart[] = [];
  if (size(data) <= SHARE_DATA_LIMIT) return { data, dropped };

  if (data.floors.some(f => f.backgroundImage)) {
    for (const floor of data.floors) delete floor.backgroundImage;
    dropped.push('backgrounds');
    if (size(data) <= SHARE_DATA_LIMIT) return { data, dropped };
  }

  if (data.projectPackage || data.customModels?.length || data.customEntourage?.length || hasPhotos(data)) {
    delete data.projectPackage;
    delete data.customModels;
    delete data.attachmentNames;
    const entourage = new Set((data.customEntourage ?? []).map(d => d.id));
    delete data.customEntourage;
    for (const floor of data.floors) {
      for (const item of floor.furniture) delete item.customModelId;
      if (floor.entourage) floor.entourage = floor.entourage.filter(e => !entourage.has(e.defId));
      for (const owner of [...floor.walls, ...floor.doors, ...floor.windows, ...floor.furniture, ...floor.rooms]) {
        if (owner.details?.photos) delete owner.details.photos;
      }
    }
    dropped.push('attachments');
    if (size(data) <= SHARE_DATA_LIMIT) return { data, dropped };
  }

  if (data.customMaterials?.some(m => m.textureDataUrl)) {
    for (const material of data.customMaterials) delete material.textureDataUrl;
    dropped.push('textures');
    if (size(data) <= SHARE_DATA_LIMIT) return { data, dropped };
  }
  throw new CloudError('too-large');
}

function hasPhotos(project: Project): boolean {
  return project.floors.some(f => [...f.walls, ...f.doors, ...f.windows, ...f.furniture, ...f.rooms].some(o => o.details?.photos?.length));
}

const TOKEN = /^[0-9a-f]{32}$/;

export function tokenFromHash(hash: string): string | null {
  const token = hash.replace(/^#/, '').trim().toLowerCase();
  return TOKEN.test(token) ? token : null;
}

/** The token sits after `#`, so it never reaches the web server or the Referer header. */
export function shareUrl(token: string): string {
  return `${location.origin}${base}/podglad#${token}`;
}

/** Saves the current version for reviewers and returns the cloud row id. */
export async function publishProject(project: Project): Promise<{ id: string; dropped: DroppedPart[] }> {
  requireSession();
  const { data, dropped } = shareableProject(project);
  const supabase = await getClient();
  const { data: row, error } = await supabase.from('projects')
    .upsert({ local_id: project.id, name: (project.name || 'PlanDom').slice(0, 200), data }, { onConflict: 'owner_id,local_id' })
    .select('id').single();
  if (error) throw error;
  return { id: row.id as string, dropped };
}

/** The cloud copy of a local project, if it was ever shared. */
export async function cloudProject(localId: string): Promise<{ id: string; updated_at: string } | null> {
  const { user } = requireSession();
  const supabase = await getClient();
  const { data, error } = await supabase.from('projects').select('id, updated_at')
    .eq('owner_id', user.id).eq('local_id', localId).maybeSingle();
  if (error) throw error;
  return data as { id: string; updated_at: string } | null;
}

export async function createShare(projectId: string, options: { label?: string; allowComments: boolean; expiresInDays?: number | null }): Promise<ShareLink> {
  requireSession();
  const supabase = await getClient();
  const label = options.label?.trim().slice(0, SHARE_LABEL_LIMIT) || null;
  const expires = options.expiresInDays ? new Date(Date.now() + options.expiresInDays * 86_400_000).toISOString() : null;
  const { data, error } = await supabase.from('project_shares')
    .insert({ project_id: projectId, label, allow_comments: options.allowComments, expires_at: expires })
    .select('token, label, allow_comments, expires_at, revoked_at, created_at').single();
  if (error) throw error;
  return data as ShareLink;
}

export async function listShares(projectId: string): Promise<ShareLink[]> {
  requireSession();
  const supabase = await getClient();
  const { data, error } = await supabase.from('project_shares')
    .select('token, label, allow_comments, expires_at, revoked_at, created_at')
    .eq('project_id', projectId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ShareLink[];
}

export async function revokeShare(token: string): Promise<void> {
  requireSession();
  const supabase = await getClient();
  const { error } = await supabase.from('project_shares').update({ revoked_at: new Date().toISOString() }).eq('token', token);
  if (error) throw error;
}

export async function setShareComments(token: string, allow: boolean): Promise<void> {
  requireSession();
  const supabase = await getClient();
  const { error } = await supabase.from('project_shares').update({ allow_comments: allow }).eq('token', token);
  if (error) throw error;
}

export async function ownerComments(projectId: string): Promise<ShareComment[]> {
  requireSession();
  const supabase = await getClient();
  const { data, error } = await supabase.from('share_comments')
    .select('id, token, author_name, body, floor_id, x, y, resolved, created_at')
    .eq('project_id', projectId).order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ShareComment[];
}

export async function setCommentResolved(id: string, resolved: boolean): Promise<void> {
  requireSession();
  const supabase = await getClient();
  const { error } = await supabase.from('share_comments').update({ resolved }).eq('id', id);
  if (error) throw error;
}

export async function deleteComment(id: string): Promise<void> {
  requireSession();
  const supabase = await getClient();
  const { error } = await supabase.from('share_comments').delete().eq('id', id);
  if (error) throw error;
}

// ───────────── Reviewer side: no account, only the token ─────────────

export async function loadSharedProject(token: string): Promise<SharedProject | null> {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('get_shared_project', { share_token: token });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return null;
  return {
    name: String(row.name ?? ''),
    project: readProject(row.data),
    updatedAt: String(row.updated_at ?? ''),
    allowComments: row.allow_comments === true,
    label: typeof row.label === 'string' ? row.label : null,
  };
}

export async function sharedComments(token: string): Promise<ShareComment[]> {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('get_share_comments', { share_token: token });
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as ShareComment[];
}

export interface NewComment { author: string; body: string; floorId?: string | null; x?: number | null; y?: number | null }

export function validComment(comment: NewComment): boolean {
  const author = comment.author.trim(), body = comment.body.trim();
  return author.length >= 1 && author.length <= COMMENT_AUTHOR_LIMIT && body.length >= 1 && body.length <= COMMENT_BODY_LIMIT
    && (comment.x == null) === (comment.y == null);
}

export async function addSharedComment(token: string, comment: NewComment): Promise<string> {
  if (!validComment(comment)) throw new CloudError('invalid');
  const supabase = await getClient();
  const point = comment.x != null && comment.y != null && Number.isFinite(comment.x) && Number.isFinite(comment.y);
  const { data, error } = await supabase.rpc('add_share_comment', {
    share_token: token,
    author_name: comment.author.trim(),
    body: comment.body.trim(),
    floor_id: comment.floorId ?? null,
    x: point ? Math.round(comment.x! * 10) / 10 : null,
    y: point ? Math.round(comment.y! * 10) / 10 : null,
  });
  if (error) throw error;
  return String(data);
}

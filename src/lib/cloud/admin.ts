import { getClient } from './client';
import { requireSession } from './auth';

export interface AdminUser {
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  confirmed: boolean;
  projects: number;
  admin: boolean;
}

export interface AdminOverview {
  users: AdminUser[];
  projects: number;
  active_shares: number;
  comments: number;
  recent_comments: { author_name: string; body: string; created_at: string; project: string }[];
}

/** The database refuses anyone who is not in app_admins. */
export async function adminOverview(): Promise<AdminOverview> {
  requireSession();
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('admin_overview');
  if (error) throw error;
  return data as AdminOverview;
}

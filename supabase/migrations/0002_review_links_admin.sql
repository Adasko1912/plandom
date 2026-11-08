-- PlanDom 0002 — linki do przeglądu z uwagami oraz administratorzy.
-- Opis: docs/01-projekt-techniczny.md, rozdz. 5.9. Wymaga 0001_init.sql.
-- Osoba z linkiem nie ma konta: widzi projekt i dopisuje uwagi wyłącznie przez funkcje
-- security definer, które sprawdzają token. Nie dostaje żadnego prawa do tabel.

-- ───────────────────────── Linki do przeglądu ─────────────────────────
alter table public.project_shares
  add column if not exists label          text check (char_length(label) <= 100),
  add column if not exists allow_comments boolean not null default true,
  add column if not exists revoked_at     timestamptz;

create index if not exists project_shares_project_idx on public.project_shares (project_id, created_at desc);

-- Ważny link: nieodwołany i nieprzeterminowany. Pusty wiersz, gdy takiego nie ma.
create or replace function public.active_share(share_token text)
returns setof public.project_shares
language sql stable security definer set search_path = public as $$
  select s.* from project_shares s
  where s.token = share_token
    and s.revoked_at is null
    and (s.expires_at is null or s.expires_at > now());
$$;
revoke all on function public.active_share(text) from public, anon, authenticated;

drop function if exists public.get_shared_project(text);
create function public.get_shared_project(share_token text)
returns table (name text, data jsonb, updated_at timestamptz, allow_comments boolean, label text)
language sql stable security definer set search_path = public as $$
  select p.name, p.data, p.updated_at, s.allow_comments, s.label
  from public.active_share(share_token) s
  join projects p on p.id = s.project_id;
$$;
revoke all on function public.get_shared_project(text) from public;
grant execute on function public.get_shared_project(text) to anon, authenticated;

-- ───────────────────────── Uwagi do projektu ─────────────────────────
create table public.share_comments (
  id          uuid primary key default gen_random_uuid(),
  token       text not null references public.project_shares(token) on delete cascade,
  project_id  uuid not null references public.projects(id) on delete cascade,
  author_name text not null check (char_length(btrim(author_name)) between 1 and 80),
  body        text not null check (char_length(btrim(body)) between 1 and 2000),
  floor_id    text check (char_length(floor_id) <= 100),
  x           double precision check (x is null or x between -1000000 and 1000000),
  y           double precision check (y is null or y between -1000000 and 1000000),
  resolved    boolean not null default false,
  created_at  timestamptz not null default now(),
  constraint share_comments_point check ((x is null) = (y is null))
);
create index share_comments_project_idx on public.share_comments (project_id, created_at);
create index share_comments_token_idx on public.share_comments (token, created_at);

alter table public.share_comments enable row level security;
-- Właściciel projektu czyta, oznacza jako załatwione i usuwa. Dodawanie tylko przez add_share_comment.
create policy share_comments_owner_select on public.share_comments for select to authenticated
  using (public.is_project_owner(project_id));
create policy share_comments_owner_update on public.share_comments for update to authenticated
  using (public.is_project_owner(project_id)) with check (public.is_project_owner(project_id));
create policy share_comments_owner_delete on public.share_comments for delete to authenticated
  using (public.is_project_owner(project_id));
revoke all on public.share_comments from anon, authenticated;
grant select, delete on public.share_comments to authenticated;
grant update (resolved) on public.share_comments to authenticated;

create or replace function public.add_share_comment(
  share_token text, author_name text, body text,
  floor_id text default null, x double precision default null, y double precision default null)
returns uuid
language plpgsql security definer set search_path = public as $$
#variable_conflict use_variable
declare
  s project_shares;
  new_id uuid;
begin
  select * into s from public.active_share(share_token);
  if not found then
    raise exception 'share not found' using errcode = 'P0002';
  end if;
  if not s.allow_comments then
    raise exception 'comments are disabled for this link' using errcode = '42501';
  end if;
  if (select count(*) from share_comments c where c.token = s.token) >= 500 then
    raise exception 'too many comments on this link' using errcode = '54000';
  end if;
  if (select count(*) from share_comments c where c.token = s.token and c.created_at > now() - interval '1 minute') >= 20 then
    raise exception 'too many comments, try again in a minute' using errcode = '54000';
  end if;
  insert into share_comments (token, project_id, author_name, body, floor_id, x, y)
  values (s.token, s.project_id, btrim(author_name), btrim(body), floor_id, x, y)
  returning id into new_id;
  return new_id;
end $$;
revoke all on function public.add_share_comment(text, text, text, text, double precision, double precision) from public;
grant execute on function public.add_share_comment(text, text, text, text, double precision, double precision) to anon, authenticated;

-- Osoby z linkiem widzą uwagi swoje i innych osób z tym samym linkiem.
create or replace function public.get_share_comments(share_token text)
returns table (id uuid, author_name text, body text, floor_id text, x double precision, y double precision, resolved boolean, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.author_name, c.body, c.floor_id, c.x, c.y, c.resolved, c.created_at
  from public.active_share(share_token) s
  join share_comments c on c.token = s.token
  order by c.created_at;
$$;
revoke all on function public.get_share_comments(text) from public;
grant execute on function public.get_share_comments(text) to anon, authenticated;

-- ───────────────────────── Administratorzy ─────────────────────────
-- Nikogo nie dodajemy tutaj (repozytorium jest publiczne). Administratora nadaje się raz
-- w SQL Editorze Supabase, po założeniu konta:
--   insert into public.app_admins (user_id) select id from auth.users where email = '<adres>';
create table public.app_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
create policy app_admins_self_select on public.app_admins for select to authenticated using (user_id = auth.uid());
revoke all on public.app_admins from anon, authenticated;
grant select on public.app_admins to authenticated;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from app_admins a where a.user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Podsumowanie dla panelu administratora. Odmawia każdemu, kto nie jest w app_admins.
create or replace function public.admin_overview()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'users', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'email', u.email,
        'created_at', u.created_at,
        'last_sign_in_at', u.last_sign_in_at,
        'confirmed', u.email_confirmed_at is not null,
        'projects', (select count(*) from projects p where p.owner_id = u.id),
        'admin', exists (select 1 from app_admins a where a.user_id = u.id)
      ) order by u.created_at desc), '[]'::jsonb)
      from auth.users u),
    'projects', (select count(*) from projects),
    'active_shares', (select count(*) from project_shares s where s.revoked_at is null and (s.expires_at is null or s.expires_at > now())),
    'comments', (select count(*) from share_comments),
    'recent_comments', (
      select coalesce(jsonb_agg(row_to_json(r)::jsonb), '[]'::jsonb) from (
        select c.author_name, left(c.body, 200) as body, c.created_at, p.name as project
        from share_comments c join projects p on p.id = c.project_id
        order by c.created_at desc limit 20) r)
  );
end $$;
revoke all on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;

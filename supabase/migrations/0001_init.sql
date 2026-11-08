-- PlanDom — schemat początkowy bazy Supabase (PostgreSQL 15+)
-- Opis: docs/01-projekt-techniczny.md, rozdz. 5.9
-- Zasada: każda tabela ma RLS; przeglądarka używa tylko klucza publicznego (anon/publishable).

create extension if not exists pgcrypto;

-- ───────────────────────── Profile użytkowników ─────────────────────────
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 100),
  locale       text not null default 'pl' check (locale in ('pl', 'en', 'pt')),
  created_at   timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────── Projekty ─────────────────────────
-- id w chmurze to UUID; OpenPlan3D nadaje projektom lokalne id (8 znaków base36, stores/project.ts),
-- dlatego lokalne id trzymamy osobno w local_id, a rekord IndexedDB zapamiętuje cloud id.
create table public.projects (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  local_id       text not null check (char_length(local_id) between 1 and 100),
  name           text not null check (char_length(name) between 1 and 200),
  description    text check (char_length(description) <= 2000),
  schema_version int  not null default 1,
  data           jsonb not null,
  has_thumbnail  boolean not null default false,   -- plik: thumbnails/<id>/thumbnail.webp
  revision       int  not null default 1,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint projects_data_size check (pg_column_size(data) < 5 * 1024 * 1024),
  unique (owner_id, local_id)
);
create index projects_owner_updated_idx on public.projects (owner_id, updated_at desc);

create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('viewer', 'editor')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index project_members_user_idx on public.project_members (user_id);

-- Funkcje pomocnicze RLS (security definer → bez rekursji polityk projects ↔ project_members)
create or replace function public.can_read_project(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from projects p where p.id = pid and p.owner_id = auth.uid())
      or exists (select 1 from project_members m where m.project_id = pid and m.user_id = auth.uid());
$$;

create or replace function public.can_edit_project(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from projects p where p.id = pid and p.owner_id = auth.uid())
      or exists (select 1 from project_members m
                 where m.project_id = pid and m.user_id = auth.uid() and m.role = 'editor');
$$;

create or replace function public.is_project_owner(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from projects p where p.id = pid and p.owner_id = auth.uid());
$$;

-- Bezpieczne odczytanie id projektu z pierwszego folderu ścieżki w Storage ('<uuid>/thumbnail.webp')
create or replace function public.project_id_from_path(object_name text)
returns uuid language plpgsql immutable as $$
begin
  return ((storage.foldername(object_name))[1])::uuid;
exception when others then
  return null;
end $$;

-- Dodanie współpracownika po adresie e-mail (właściciel nie zna UUID innych użytkowników)
create or replace function public.add_project_member(pid uuid, member_email text, member_role text)
returns void language plpgsql security definer set search_path = public as $$
declare
  target uuid;
begin
  if not public.is_project_owner(pid) then
    raise exception 'only the owner can add members';
  end if;
  if member_role not in ('viewer', 'editor') then
    raise exception 'invalid role';
  end if;
  select u.id into target from auth.users u where lower(u.email) = lower(member_email);
  if target is null then
    raise exception 'user not found';   -- świadomie: właściciel dowie się, czy adres ma konto
  end if;
  if target = auth.uid() then
    raise exception 'owner is already a member';
  end if;
  insert into project_members (project_id, user_id, role) values (pid, target, member_role)
  on conflict (project_id, user_id) do update set role = excluded.role;
end $$;
revoke all on function public.add_project_member(uuid, text, text) from public, anon;
grant execute on function public.add_project_member(uuid, text, text) to authenticated;

-- Trigger: rewizja (wykrywanie konfliktów), data zmiany, zakaz zmiany właściciela
create or replace function public.projects_before_update()
returns trigger language plpgsql as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'owner_id cannot be changed';
  end if;
  if new.local_id is distinct from old.local_id then
    raise exception 'local_id cannot be changed';   -- edytor nie może zepsuć mapowania lokalnego id właściciela
  end if;
  new.revision   := old.revision + 1;
  new.updated_at := now();
  new.created_at := old.created_at;
  return new;
end $$;

create trigger projects_before_update
  before update on public.projects
  for each row execute function public.projects_before_update();

-- Klient zapisuje warunkowo:
--   update projects set data = ..., name = ... where id = :id and revision = :rev returning revision;
-- 0 zwróconych wierszy = konflikt (ktoś zapisał wcześniej).

-- ───────────────────────── Migawki wersji ─────────────────────────
create table public.project_versions (
  id         bigint generated always as identity primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  revision   int  not null,
  label      text check (char_length(label) <= 200),
  data       jsonb not null,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (project_id, revision)
);

-- Limit 10 migawek na projekt (najstarsze usuwane). Każda migawka to pełna kopia `data`
-- (do 500 KB), więc przy 500 MB planu Free większy limit szybko zjada miejsce.
create or replace function public.project_versions_prune()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from project_versions v
  where v.project_id = new.project_id
    and v.id not in (
      select id from project_versions
      where project_id = new.project_id
      order by created_at desc, id desc
      limit 10
    );
  return null;
end $$;

create trigger project_versions_prune
  after insert on public.project_versions
  for each row execute function public.project_versions_prune();

-- ───────────────────────── Linki do podglądu ─────────────────────────
create table public.project_shares (
  token      text primary key default encode(gen_random_bytes(16), 'hex'),
  project_id uuid not null references public.projects(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- Odczyt projektu po tokenie (także dla niezalogowanych) — tylko nazwa i dane, bez właściciela
create or replace function public.get_shared_project(share_token text)
returns table (name text, data jsonb, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.name, p.data, p.updated_at
  from project_shares s
  join projects p on p.id = s.project_id
  where s.token = share_token
    and (s.expires_at is null or s.expires_at > now());
$$;
revoke all on function public.get_shared_project(text) from public;
grant execute on function public.get_shared_project(text) to anon, authenticated;

-- ───────────────────────── Własne modele 3D ─────────────────────────
create table public.user_models (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 200),
  storage_path text not null unique,          -- '<uid>/<id>.glb' w buckecie user-models
  sha256       text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  byte_length  int  not null check (byte_length > 0 and byte_length <= 20 * 1024 * 1024),
  width_cm     numeric(8,2) check (width_cm  > 0),
  depth_cm     numeric(8,2) check (depth_cm  > 0),
  height_cm    numeric(8,2) check (height_cm > 0),
  category     text,
  license      text,
  attribution  text,
  source_url   text,
  created_at   timestamptz not null default now()
);

-- ───────────────────────── Cenniki (kosztorys) ─────────────────────────
create table public.price_lists (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid references auth.users(id) on delete cascade,   -- null = cennik systemowy
  name       text not null,
  currency   text not null default 'PLN',
  region     text,
  valid_from date,
  created_at timestamptz not null default now()
);

create table public.price_items (
  id            bigint generated always as identity primary key,
  price_list_id uuid not null references public.price_lists(id) on delete cascade,
  code          text not null,          -- np. 'paint.wall.m2', 'tile.floor.m2', 'kitchen.base.60'
  name          text not null,
  unit          text not null check (unit in ('m2', 'm', 'szt', 'm3', 'kpl', 'h')),
  unit_price    numeric(12,2) not null check (unit_price >= 0),
  labor_price   numeric(12,2) not null default 0 check (labor_price >= 0),
  waste_factor  numeric(4,3)  not null default 0 check (waste_factor between 0 and 1),
  unique (price_list_id, code)
);

-- ───────────────────────── Ulubione z katalogu ─────────────────────────
create table public.user_favorites (
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  catalog_item_id text not null,
  created_at      timestamptz not null default now(),
  primary key (user_id, catalog_item_id)
);

-- ═════════════════════════ RLS ═════════════════════════
alter table public.profiles         enable row level security;
alter table public.projects         enable row level security;
alter table public.project_members  enable row level security;
alter table public.project_versions enable row level security;
alter table public.project_shares   enable row level security;
alter table public.user_models      enable row level security;
alter table public.price_lists      enable row level security;
alter table public.price_items      enable row level security;
alter table public.user_favorites   enable row level security;

-- profiles
create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- projects
-- owner_id sprawdzany wprost: przy insert … returning nowego wiersza nie widać jeszcze w podzapytaniu can_read_project.
create policy projects_select on public.projects for select to authenticated
  using (owner_id = auth.uid() or public.can_read_project(id));
create policy projects_insert on public.projects for insert to authenticated with check (owner_id = auth.uid());
create policy projects_update on public.projects for update to authenticated
  using (public.can_edit_project(id)) with check (public.can_edit_project(id));
create policy projects_delete on public.projects for delete to authenticated using (owner_id = auth.uid());

-- project_members: widzą członkowie, zarządza właściciel
create policy members_select on public.project_members for select to authenticated using (public.can_read_project(project_id));
create policy members_insert on public.project_members for insert to authenticated with check (public.is_project_owner(project_id));
create policy members_update on public.project_members for update to authenticated
  using (public.is_project_owner(project_id)) with check (public.is_project_owner(project_id));
create policy members_delete on public.project_members for delete to authenticated
  using (public.is_project_owner(project_id) or user_id = auth.uid());   -- można samemu opuścić projekt

-- project_versions: czytają uprawnieni, tworzą edytujący, usuwa właściciel
create policy versions_select on public.project_versions for select to authenticated using (public.can_read_project(project_id));
create policy versions_insert on public.project_versions for insert to authenticated
  with check (public.can_edit_project(project_id) and created_by = auth.uid());
create policy versions_delete on public.project_versions for delete to authenticated using (public.is_project_owner(project_id));

-- project_shares: tylko właściciel (odczyt publiczny przez get_shared_project)
create policy shares_owner_all on public.project_shares for all to authenticated
  using (public.is_project_owner(project_id))
  with check (public.is_project_owner(project_id) and created_by = auth.uid());

-- user_models
create policy user_models_owner_all on public.user_models for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- price_lists: systemowe czytają wszyscy zalogowani, własne tylko właściciel
create policy price_lists_select on public.price_lists for select to authenticated
  using (owner_id is null or owner_id = auth.uid());
create policy price_lists_insert on public.price_lists for insert to authenticated with check (owner_id = auth.uid());
create policy price_lists_update on public.price_lists for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy price_lists_delete on public.price_lists for delete to authenticated using (owner_id = auth.uid());

-- price_items: dziedziczą uprawnienia cennika
create policy price_items_select on public.price_items for select to authenticated
  using (exists (select 1 from public.price_lists l
                 where l.id = price_list_id and (l.owner_id is null or l.owner_id = auth.uid())));
create policy price_items_write on public.price_items for all to authenticated
  using (exists (select 1 from public.price_lists l where l.id = price_list_id and l.owner_id = auth.uid()))
  with check (exists (select 1 from public.price_lists l where l.id = price_list_id and l.owner_id = auth.uid()));

-- user_favorites
create policy favorites_owner_all on public.user_favorites for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ═════════════════════════ Storage ═════════════════════════
-- Buckety prywatne, dostęp przez podpisane adresy URL.
--   thumbnails:  '<project_id>/thumbnail.webp' — prawa wynikają z projektu (nie z dowolnej ścieżki
--                zapisanej w tabeli, która pozwalałaby wskazać cudzy plik)
--   user-models: '<uid>/<model_id>.glb'        — prawa ma tylko właściciel pliku
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('thumbnails',  'thumbnails',  false,  1048576, array['image/webp', 'image/png']),
  ('user-models', 'user-models', false, 20971520, array['model/gltf-binary', 'application/octet-stream'])
on conflict (id) do nothing;

create policy thumbnails_select on storage.objects for select to authenticated
  using (bucket_id = 'thumbnails' and public.can_read_project(public.project_id_from_path(name)));
create policy thumbnails_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'thumbnails' and public.can_edit_project(public.project_id_from_path(name)));
create policy thumbnails_update on storage.objects for update to authenticated
  using (bucket_id = 'thumbnails' and public.can_edit_project(public.project_id_from_path(name)))
  with check (bucket_id = 'thumbnails' and public.can_edit_project(public.project_id_from_path(name)));
create policy thumbnails_delete on storage.objects for delete to authenticated
  using (bucket_id = 'thumbnails' and public.can_edit_project(public.project_id_from_path(name)));

create policy user_models_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'user-models' and (storage.foldername(name))[1] = auth.uid()::text);
create policy user_models_files_update on storage.objects for update to authenticated
  using (bucket_id = 'user-models' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'user-models' and (storage.foldername(name))[1] = auth.uid()::text);
create policy user_models_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'user-models' and (storage.foldername(name))[1] = auth.uid()::text);
create policy user_models_files_select on storage.objects for select to authenticated
  using (bucket_id = 'user-models' and (storage.foldername(name))[1] = auth.uid()::text);

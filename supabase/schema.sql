-- O que vamos ver? — estrutura inicial do banco
-- Execute este arquivo no SQL Editor de um projeto Supabase novo.

create extension if not exists pgcrypto;

create type public.watch_status as enum ('watchlist', 'watching', 'watched');
create type public.media_type as enum ('movie', 'tv', 'reality');
create type public.household_role as enum ('owner', 'member');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  invite_code text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 6)),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.household_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index household_members_user_id_idx on public.household_members(user_id);

create table public.titles (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  tmdb_id bigint,
  media_type public.media_type not null,
  title text not null,
  original_title text,
  overview text,
  poster_url text,
  backdrop_url text,
  release_year smallint,
  genres text[] not null default '{}',
  total_seasons smallint,
  total_episodes integer,
  current_season smallint,
  watched_episodes integer not null default 0 check (watched_episodes >= 0),
  season_progress jsonb not null default '[]'::jsonb,
  status public.watch_status not null default 'watchlist',
  rating smallint check (rating between 1 and 5),
  notes text,
  recommended_by text,
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz not null default now(),
  status_changed_at timestamptz not null default now(),
  started_at timestamptz,
  watched_at timestamptz,
  updated_at timestamptz not null default now(),
  unique nulls not distinct (household_id, tmdb_id, media_type)
);

create index titles_household_id_idx on public.titles(household_id);
create index titles_household_status_idx on public.titles(household_id, status);

create table public.status_history (
  id bigint generated always as identity primary key,
  title_id uuid not null references public.titles(id) on delete cascade,
  from_status public.watch_status,
  to_status public.watch_status not null,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index status_history_title_id_idx on public.status_history(title_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.is_household_member(target_household uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members
    where household_id = target_household and user_id = (select auth.uid())
  );
$$;

create or replace function public.create_household(household_name text)
returns table (id uuid, name text, invite_code text)
language plpgsql security definer set search_path = '' as $$
declare new_household public.households;
begin
  if auth.uid() is null then raise exception 'Você precisa estar autenticado.'; end if;
  if exists (select 1 from public.household_members where user_id = auth.uid()) then
    raise exception 'Você já participa de uma casa.';
  end if;
  if exists (
    select 1
    from public.households
    where invite_code = upper(trim(household_name))
  ) then
    raise exception 'Esse é um código de convite. Escolha "Entrar com código" para participar dessa casa.';
  end if;
  insert into public.households (name, created_by)
  values (trim(household_name), auth.uid()) returning * into new_household;
  insert into public.household_members (household_id, user_id, role)
  values (new_household.id, auth.uid(), 'owner');
  return query select new_household.id, new_household.name, new_household.invite_code;
end;
$$;

create or replace function public.join_household(code text)
returns table (id uuid, name text, invite_code text)
language plpgsql security definer set search_path = '' as $$
declare selected_household public.households;
begin
  if auth.uid() is null then raise exception 'Você precisa estar autenticado.'; end if;
  if exists (select 1 from public.household_members where user_id = auth.uid()) then
    raise exception 'Você já participa de uma casa.';
  end if;
  select * into selected_household from public.households where households.invite_code = upper(trim(code));
  if selected_household.id is null then raise exception 'Código de convite não encontrado.'; end if;
  insert into public.household_members (household_id, user_id)
  values (selected_household.id, auth.uid());
  return query select selected_household.id, selected_household.name, selected_household.invite_code;
end;
$$;

create or replace function public.set_title_timestamps()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at = now();
  if new.status is distinct from old.status then new.status_changed_at = now(); end if;
  return new;
end;
$$;

create or replace function public.track_title_status()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.status_history (title_id, from_status, to_status, changed_by, changed_at)
    values (new.id, case when tg_op = 'UPDATE' then old.status else null end, new.status, auth.uid(), new.status_changed_at);
  end if;
  return null;
end;
$$;

create trigger set_title_timestamps_trigger
  before update on public.titles
  for each row execute procedure public.set_title_timestamps();

create trigger track_title_status_trigger
  after insert or update on public.titles
  for each row execute procedure public.track_title_status();

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.titles enable row level security;
alter table public.status_history enable row level security;

revoke all on table public.profiles, public.households, public.household_members, public.titles, public.status_history from anon;
grant select on table public.profiles, public.households, public.household_members, public.titles, public.status_history to authenticated;
grant update on table public.profiles to authenticated;
grant insert, update, delete on table public.titles to authenticated;

create policy "profiles: authenticated read" on public.profiles for select to authenticated using (true);
create policy "profiles: update self" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "households: members read" on public.households for select to authenticated using (public.is_household_member(id));
create policy "members: household read" on public.household_members for select to authenticated using (public.is_household_member(household_id));
create policy "titles: members read" on public.titles for select to authenticated using (public.is_household_member(household_id));
create policy "titles: members add" on public.titles for insert to authenticated with check (public.is_household_member(household_id) and added_by = (select auth.uid()));
create policy "titles: members update" on public.titles for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "titles: members delete" on public.titles for delete to authenticated using (public.is_household_member(household_id));
create policy "history: members read" on public.status_history for select to authenticated using (
  exists (select 1 from public.titles where titles.id = status_history.title_id and public.is_household_member(titles.household_id))
);

grant execute on function public.create_household(text) to authenticated;
grant execute on function public.join_household(text) to authenticated;
grant execute on function public.is_household_member(uuid) to authenticated;

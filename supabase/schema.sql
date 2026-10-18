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
    where invite_code = upper(regexp_replace(household_name, '[[:space:]]', '', 'g'))
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
  select * into selected_household
  from public.households
  where households.invite_code = upper(regexp_replace(code, '[[:space:]]', '', 'g'));
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

-- Lembrete diário por notificação push.
-- Execute uma vez no SQL Editor do Supabase (o conteúdo também está no final de schema.sql).

-- Aparelhos inscritos para receber o lembrete.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_id_idx on public.push_subscriptions(user_id);

-- Histórico do sorteio: no máximo um lembrete por casa por dia.
create table public.daily_reminders (
  id bigint generated always as identity primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  title_id uuid references public.titles(id) on delete set null,
  sent_on date not null,
  created_at timestamptz not null default now(),
  unique (household_id, sent_on)
);

create index daily_reminders_household_created_idx on public.daily_reminders(household_id, created_at desc);

alter table public.push_subscriptions enable row level security;
alter table public.daily_reminders enable row level security;

revoke all on table public.push_subscriptions, public.daily_reminders from anon, authenticated;
grant select, delete on table public.push_subscriptions to authenticated;

create policy "push: read own" on public.push_subscriptions for select to authenticated using ((select auth.uid()) = user_id);
create policy "push: delete own" on public.push_subscriptions for delete to authenticated using ((select auth.uid()) = user_id);
-- daily_reminders fica sem políticas: só o service role (função agendada) acessa.

-- Inscreve (ou reatribui) o aparelho para quem está logado.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Você precisa estar autenticado.'; end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent;
end;
$$;

create or replace function public.delete_push_subscription(p_endpoint text)
returns void language sql security definer set search_path = '' as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = (select auth.uid());
$$;

revoke execute on function public.save_push_subscription(text, text, text, text) from public, anon;
revoke execute on function public.delete_push_subscription(text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.delete_push_subscription(text) to authenticated;

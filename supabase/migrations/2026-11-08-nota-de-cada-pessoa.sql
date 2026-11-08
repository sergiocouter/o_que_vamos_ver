-- Nota de cada pessoa: uma nota (1 a 5) por pessoa e título. A nota da casa passa a ser a média,
-- calculada no app. A coluna antiga titles.rating fica sem uso (permite desfazer).
-- Execute uma vez no SQL Editor do Supabase (o conteúdo também está no final de schema.sql).

create table public.title_ratings (
  title_id uuid not null references public.titles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  rated_at timestamptz not null default now(),
  primary key (title_id, user_id)
);

create index title_ratings_user_id_idx on public.title_ratings(user_id);

alter table public.title_ratings enable row level security;

revoke all on table public.title_ratings from anon;
grant select, insert, update, delete on table public.title_ratings to authenticated;

create policy "ratings: members read" on public.title_ratings for select to authenticated using (
  exists (select 1 from public.titles where titles.id = title_ratings.title_id and public.is_household_member(titles.household_id))
);
create policy "ratings: add own" on public.title_ratings for insert to authenticated with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.titles where titles.id = title_ratings.title_id and public.is_household_member(titles.household_id))
);
create policy "ratings: update own" on public.title_ratings for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.titles where titles.id = title_ratings.title_id and public.is_household_member(titles.household_id))
  );
create policy "ratings: delete own" on public.title_ratings for delete to authenticated using (user_id = (select auth.uid()));

-- Notas antigas (uma por título) viram a nota de quem adicionou o título.
insert into public.title_ratings (title_id, user_id, rating, rated_at)
select id, added_by, rating, coalesce(watched_at, status_changed_at)
from public.titles
where rating is not null and added_by is not null
on conflict do nothing;

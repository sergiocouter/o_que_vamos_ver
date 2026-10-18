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

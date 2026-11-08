-- Corrige "Criar casa": desde 2026-08-24 a função falhava para todo mundo com
-- 'column reference "invite_code" is ambiguous', porque a coluna de saída
-- invite_code (returns table) tinha o mesmo nome da coluna da tabela.
-- Execute uma vez no SQL Editor do Supabase (o conteúdo também está em schema.sql).

create or replace function public.create_household(household_name text)
returns table (id uuid, name text, invite_code text)
language plpgsql security definer set search_path = '' as $$
declare new_household public.households;
begin
  if auth.uid() is null then raise exception 'Você precisa estar autenticado.'; end if;
  if exists (select 1 from public.household_members where household_members.user_id = auth.uid()) then
    raise exception 'Você já participa de uma casa.';
  end if;
  if exists (
    select 1
    from public.households
    where households.invite_code = upper(regexp_replace(household_name, '[[:space:]]', '', 'g'))
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

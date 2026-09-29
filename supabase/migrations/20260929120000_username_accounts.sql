alter table private.access_accounts alter column access_hash drop not null;
alter table private.access_accounts add column username text unique;
alter table private.access_accounts add constraint access_accounts_username_format
  check (username is null or username ~ '^[a-z0-9_]{3,24}$');
alter table private.access_accounts add constraint access_accounts_has_locator
  check (access_hash is not null or username is not null);

create function public.open_username(p_username text)
returns table(account_id uuid, username text, created boolean)
language plpgsql security definer set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  normalized text := pg_catalog.lower(pg_catalog.btrim(p_username, E' \t\n\r'));
  found_account uuid;
  was_created boolean := false;
begin
  if caller is null then raise exception 'not authorized'; end if;
  if normalized is null or normalized !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'invalid username';
  end if;
  insert into private.access_accounts(username) values (normalized)
    on conflict on constraint access_accounts_username_key do nothing returning id into found_account;
  if found_account is null then
    select a.id into found_account from private.access_accounts a where a.username = normalized;
  else
    was_created := true;
  end if;
  insert into public.account_memberships(account_id,user_id)
    values (found_account,caller) on conflict do nothing;
  account_id := found_account;
  username := normalized;
  created := was_created;
  return next;
end;
$$;

create function public.claim_username(p_account_id uuid,p_username text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  normalized text := pg_catalog.lower(pg_catalog.btrim(p_username, E' \t\n\r'));
  current_name text;
begin
  if caller is null or not exists (
    select 1 from public.account_memberships m
    where m.account_id = p_account_id and m.user_id = caller
  ) then raise exception 'not authorized'; end if;
  if normalized is null or normalized !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'invalid username';
  end if;
  begin
    update private.access_accounts a set username = normalized
      where a.id = p_account_id and a.username is null
      returning a.username into current_name;
  exception when unique_violation then
    raise exception 'username unavailable';
  end;
  if current_name is null then
    select a.username into current_name from private.access_accounts a where a.id = p_account_id;
    if current_name is distinct from normalized then raise exception 'username already assigned'; end if;
  end if;
  return current_name;
end;
$$;

create function public.account_username(p_account_id uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  current_name text;
begin
  if caller is null or not exists (
    select 1 from public.account_memberships m
    where m.account_id = p_account_id and m.user_id = caller
  ) then raise exception 'not authorized'; end if;
  select a.username into current_name from private.access_accounts a where a.id = p_account_id;
  return current_name;
end;
$$;

revoke execute on function public.open_username(text) from public, anon, authenticated;
revoke execute on function public.claim_username(uuid,text) from public, anon, authenticated;
revoke execute on function public.account_username(uuid) from public, anon, authenticated;
grant execute on function public.open_username(text) to authenticated;
grant execute on function public.claim_username(uuid,text) to authenticated;
grant execute on function public.account_username(uuid) to authenticated;

create schema if not exists private;
create extension if not exists pgcrypto with schema extensions;

create table private.access_accounts (
  id uuid primary key default gen_random_uuid(),
  access_hash bytea not null unique,
  created_at timestamptz not null default now()
);
create table public.account_memberships (
  account_id uuid not null references private.access_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (account_id, user_id)
);
create index account_memberships_user_idx on public.account_memberships (user_id, account_id);
create table public.saved_decks (
  account_id uuid not null references private.access_accounts(id) on delete cascade,
  game text not null check (game in ('onepiece','pokemon','yugioh')),
  deck_id text not null check (length(deck_id) between 1 and 128),
  payload jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  primary key (account_id, game, deck_id),
  check (jsonb_typeof(payload) = 'object' and payload->>'id' = deck_id and octet_length(payload::text) <= 100000)
);

alter table private.access_accounts enable row level security;
alter table public.account_memberships enable row level security;
alter table public.saved_decks enable row level security;
revoke all on private.access_accounts from public, anon, authenticated;
revoke all on public.account_memberships from public, anon, authenticated;
revoke all on public.saved_decks from public, anon, authenticated;
grant select on public.account_memberships to authenticated;
grant select on public.saved_decks to authenticated;

create policy "Read own membership" on public.account_memberships
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Read linked decks" on public.saved_decks
  for select to authenticated using (
    exists (select 1 from public.account_memberships m
      where m.account_id = saved_decks.account_id and m.user_id = (select auth.uid()))
  );

create function public.create_access_id()
returns table(account_id uuid, access_id text)
language plpgsql security definer set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  raw_code bytea := extensions.gen_random_bytes(24);
begin
  if caller is null then raise exception 'not authorized'; end if;
  insert into private.access_accounts(access_hash)
    values (extensions.digest(raw_code,'sha256')) returning id into account_id;
  insert into public.account_memberships(account_id,user_id) values (account_id,caller);
  access_id := pg_catalog.encode(raw_code,'hex');
  return next;
end;
$$;

create function public.redeem_access_id(p_access_id text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  found_account uuid;
begin
  if caller is null then raise exception 'not authorized'; end if;
  if p_access_id is null or p_access_id !~ '^[0-9a-f]{48}$' then
    raise exception 'invalid access ID';
  end if;
  select id into found_account from private.access_accounts
    where access_hash = extensions.digest(pg_catalog.decode(p_access_id,'hex'),'sha256');
  if found_account is null then raise exception 'invalid access ID'; end if;
  insert into public.account_memberships(account_id,user_id)
    values (found_account,caller) on conflict do nothing;
  return found_account;
end;
$$;

create function public.save_deck(
  p_account_id uuid, p_game text, p_deck_id text, p_payload jsonb, p_expected_revision bigint
)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  next_revision bigint;
begin
  if caller is null or not exists (
    select 1 from public.account_memberships
      where account_id = p_account_id and user_id = caller
  ) then raise exception 'not authorized'; end if;
  if p_game is null or p_game not in ('onepiece','pokemon','yugioh')
    or p_deck_id is null or length(p_deck_id) not between 1 and 128
    or p_payload is null or pg_catalog.jsonb_typeof(p_payload) <> 'object'
    or p_payload->>'id' is distinct from p_deck_id
    or pg_catalog.octet_length(p_payload::text) > 100000
    or p_expected_revision is null or p_expected_revision < 0
  then raise exception 'invalid deck'; end if;
  if p_expected_revision = 0 then
    insert into public.saved_decks(account_id,game,deck_id,payload)
      values (p_account_id,p_game,p_deck_id,p_payload) on conflict do nothing
      returning revision into next_revision;
  else
    update public.saved_decks set payload=p_payload,revision=revision+1,updated_at=now()
      where account_id=p_account_id and game=p_game and deck_id=p_deck_id
        and revision=p_expected_revision
      returning revision into next_revision;
  end if;
  if next_revision is null then raise exception 'stale revision'; end if;
  return next_revision;
end;
$$;

revoke execute on function public.create_access_id() from public, anon, authenticated;
revoke execute on function public.redeem_access_id(text) from public, anon, authenticated;
revoke execute on function public.save_deck(uuid,text,text,jsonb,bigint) from public, anon, authenticated;
grant execute on function public.create_access_id() to authenticated;
grant execute on function public.redeem_access_id(text) to authenticated;
grant execute on function public.save_deck(uuid,text,text,jsonb,bigint) to authenticated;

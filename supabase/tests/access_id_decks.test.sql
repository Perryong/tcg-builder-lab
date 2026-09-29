begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, instance_id, aud, role, is_anonymous, created_at, updated_at)
values
 ('11111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated',true,now(),now()),
 ('22222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated',true,now(),now()),
 ('33333333-3333-4333-8333-333333333333','00000000-0000-0000-0000-000000000000','authenticated','authenticated',true,now(),now());

create temporary table fixture (account_id uuid, access_id text);
grant select, insert on fixture to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
insert into fixture select account_id, access_id from public.create_access_id();
select is(length(access_id),48,'generated access ID is 48 hex characters') from fixture;
select ok(access_id ~ '^[0-9a-f]{48}$','generated ID uses expected alphabet') from fixture;
select ok(account_id is not null,'account has UUID') from fixture;
reset role;

select ok(not has_function_privilege('anon','public.create_access_id()','EXECUTE'),'unsigned callers cannot create IDs');
select ok(not has_table_privilege('anon','public.saved_decks','SELECT'),'unsigned callers cannot list decks');

set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select is(public.redeem_access_id((select access_id from fixture)),(select account_id from fixture),'a second browser redeems the ID');
select is((select count(*)::integer from public.saved_decks),0,'new account has no decks');
select is(public.save_deck((select account_id from fixture),'onepiece','deck-1','{"id":"deck-1","name":"Crew"}'::jsonb,0),1::bigint,'member can insert first revision');
select is(public.save_deck((select account_id from fixture),'onepiece','deck-1','{"id":"deck-1","name":"Crew v2"}'::jsonb,1),2::bigint,'member can update matching revision');
select is((select payload->>'name' from public.saved_decks where deck_id='deck-1'),'Crew v2','member reads saved payload');
select throws_ok(format('select public.save_deck(%L,%L,%L,%L::jsonb,1)',(select account_id from fixture),'onepiece','deck-1','{"id":"deck-1"}'),'stale revision','stale writer cannot replace a newer deck');
select throws_ok(format('select public.save_deck(%L,%L,%L,%L::jsonb,0)',(select account_id from fixture),'other','deck-2','{"id":"deck-2"}'),'invalid deck','unsupported game rejected');
select throws_ok(format('select public.save_deck(%L,%L,%L,%L::jsonb,0)',(select account_id from fixture),'pokemon','deck-2','{"id":"wrong"}'),'invalid deck','payload ID must match row ID');
select throws_ok(format('select public.save_deck(%L,%L,%L,jsonb_build_object(''id'',''deck-2'',''name'',repeat(''x'',200000)),0)',(select account_id from fixture),'pokemon','deck-2'),'invalid deck','oversized payload rejected');
select throws_ok($$select public.redeem_access_id('bad')$$,'invalid access ID','malformed IDs reveal nothing');
select throws_ok($$select public.redeem_access_id('000000000000000000000000000000000000000000000000')$$,'invalid access ID','unknown IDs have the same error');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select is((select count(*)::integer from public.saved_decks),0,'unlinked user sees no decks');
select throws_ok(format('select public.save_deck(%L,%L,%L,%L::jsonb,0)',(select account_id from fixture),'pokemon','deck-3','{"id":"deck-3"}'),'not authorized','forged account ID cannot save');
select throws_ok(format('insert into public.saved_decks(account_id,game,deck_id,payload) values (%L,%L,%L,%L::jsonb)',(select account_id from fixture),'pokemon','deck-3','{"id":"deck-3"}'),'permission denied for table saved_decks','direct table write is denied');
select ok(not has_table_privilege('authenticated','public.saved_decks','INSERT'),'clients cannot write the deck table directly');
select * from finish();
rollback;

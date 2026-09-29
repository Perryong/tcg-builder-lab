begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, instance_id, aud, role, is_anonymous, created_at, updated_at)
values
 ('44444444-4444-4444-8444-444444444444','00000000-0000-0000-0000-000000000000','authenticated','authenticated',true,now(),now()),
 ('55555555-5555-4555-8555-555555555555','00000000-0000-0000-0000-000000000000','authenticated','authenticated',true,now(),now()),
 ('66666666-6666-4666-8666-666666666666','00000000-0000-0000-0000-000000000000','authenticated','authenticated',true,now(),now());

create temporary table username_fixture(label text primary key, account_id uuid, username text, created boolean, access_id text);
grant select, insert on username_fixture to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
insert into username_fixture(label,account_id,username,created)
  select 'first',account_id,username,created from public.open_username(' Perry_1 ');
select is((select username from username_fixture where label='first'),'perry_1','username is trimmed and case folded');
select is((select created from username_fixture where label='first'),true,'first open creates the account');
select is(public.account_username((select account_id from username_fixture where label='first')),'perry_1','member can read current username');
select throws_ok($$select * from public.open_username('ab')$$,'invalid username','short name rejected');
select throws_ok($$select * from public.open_username('abcdefghijklmnopqrstuvwxy')$$,'invalid username','long name rejected');
select throws_ok($$select * from public.open_username('perry-name')$$,'invalid username','punctuation rejected');
insert into username_fixture(label,account_id,access_id)
  select 'legacy',account_id,access_id from public.create_access_id();
select is(public.save_deck((select account_id from username_fixture where label='legacy'),'onepiece','old-deck','{"id":"old-deck","name":"Old crew"}'::jsonb,0),1::bigint,'legacy deck exists before claim');
select throws_ok(format('select public.claim_username(%L,%L)',(select account_id from username_fixture where label='legacy'),'perry_1'),'username unavailable','taken username cannot be claimed');
select is(public.claim_username((select account_id from username_fixture where label='legacy'),'Legacy_Crew'),'legacy_crew','old account claims normalized username');
select is((select payload->>'name' from public.saved_decks where deck_id='old-deck'),'Old crew','claim preserves legacy deck');
select throws_ok(format('select public.claim_username(%L,%L)',(select account_id from username_fixture where label='legacy'),'another_name'),'username already assigned','claimed account cannot be renamed');
reset role;

select ok(not has_function_privilege('anon','public.open_username(text)','EXECUTE'),'unsigned caller cannot open usernames');
select ok(not has_table_privilege('authenticated','private.access_accounts','SELECT'),'clients cannot read account locators');
select ok((select access_hash is null from private.access_accounts where id=(select account_id from username_fixture where label='first')),'new username has no legacy ID hash');

set local role authenticated;
select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',true);
insert into username_fixture(label,account_id,username,created)
  select 'second',account_id,username,created from public.open_username('perry_1');
select is((select account_id from username_fixture where label='second'),(select account_id from username_fixture where label='first'),'second user opens the same account');
select is((select created from username_fixture where label='second'),false,'second open does not recreate account');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','66666666-6666-4666-8666-666666666666',true);
select throws_ok(format('select public.account_username(%L)',(select account_id from username_fixture where label='legacy')),'not authorized','unlinked user cannot look up account username');
select throws_ok(format('select public.claim_username(%L,%L)',(select account_id from username_fixture where label='legacy'),'intruder'),'not authorized','unlinked user cannot claim account');
reset role;

select * from finish();
rollback;

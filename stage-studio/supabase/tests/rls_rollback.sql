-- Run as the project's postgres/admin SQL role AFTER all three migrations.
-- Every fixture, function, metadata object and user is inside this transaction.
-- A failed assertion aborts the transaction; issue ROLLBACK if the SQL client
-- stops before reaching the final ROLLBACK. No email is sent and no auth token
-- is created. These fixtures can never be used for login.
begin;

create temporary table stagecue_rls_results (check_name text primary key, passed boolean not null) on commit drop;
grant select, insert on stagecue_rls_results to authenticated, anon;
create function pg_temp.stagecue_assert(ok boolean, label text) returns void language plpgsql security invoker as $$
begin
  if not coalesce(ok,false) then raise exception 'RLS assertion failed: %', label; end if;
  insert into stagecue_rls_results values (label,true);
end;
$$;
create function pg_temp.stagecue_denied(statement text, label text) returns void language plpgsql security invoker as $$
begin
  begin
    execute statement;
  exception when insufficient_privilege then
    insert into stagecue_rls_results values (label,true);
    return;
  end;
  raise exception 'Expected RLS/permission denial: %', label;
end;
$$;
grant execute on function pg_temp.stagecue_assert(boolean,text), pg_temp.stagecue_denied(text,text) to authenticated, anon;
-- Newer Supabase projects protect storage.objects from direct SQL DELETE.
-- Evaluate the real DELETE USING expression against hypothetical object rows
-- under the current auth role instead of disabling or bypassing that trigger.
create function pg_temp.stagecue_storage_delete_allowed(object_name text) returns boolean language plpgsql security invoker as $$
declare predicate text; allowed boolean;
begin
  select qual into predicate from pg_policies where schemaname='storage' and tablename='objects' and policyname='stage_storage_delete' and cmd='DELETE' and 'authenticated'=any(roles);
  if predicate is null then raise exception 'Missing authenticated storage DELETE policy'; end if;
  execute format('select coalesce((%s),false) from (select ''stage-assets''::text as bucket_id, $1::text as name) objects',predicate) into allowed using object_name;
  return allowed;
exception when insufficient_privilege then
  -- anon deliberately lacks SELECT on stage_shows. The policy is scoped TO
  -- authenticated, so evaluating its predicate manually as anon can raise this
  -- earlier table-privilege denial; that still correctly denies the operation.
  if current_user='anon' then return false; end if;
  raise;
end;
$$;
grant execute on function pg_temp.stagecue_storage_delete_allowed(text) to authenticated, anon;

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
 ('10000000-0000-4000-8000-000000000001','authenticated','authenticated','stagecue-rls-owner-1@example.invalid','{}','{}',now(),now()),
 ('10000000-0000-4000-8000-000000000002','authenticated','authenticated','stagecue-rls-owner-2@example.invalid','{}','{}',now(),now());
insert into public.stage_shows (id, owner_id, title, document) values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','RLS fixture one','{"schemaVersion":1,"scenes":[],"tracks":[],"settings":{}}'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','RLS fixture two','{"schemaVersion":1,"scenes":[],"tracks":[],"settings":{}}');
insert into public.stage_assets (id, show_id, owner_id, path, name, mime_type, size) values
 ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000001/one.png','one.png','image/png',42),
 ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002/20000000-0000-4000-8000-000000000002/two.png','two.png','image/png',42);
-- Storage API bytes are not uploaded. Only disposable DB object metadata is
-- inserted to exercise the actual storage.objects policies, then rolled back.
insert into storage.objects (bucket_id, name) values
 ('stage-assets','10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000001/one.png'),
 ('stage-assets','10000000-0000-4000-8000-000000000002/20000000-0000-4000-8000-000000000002/two.png');

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select pg_temp.stagecue_assert((select count(*)=1 from public.stage_shows),'owner sees only own show');
select pg_temp.stagecue_assert((select count(*)=1 from public.stage_assets),'owner sees only own asset');
select pg_temp.stagecue_assert((select count(*)=1 from storage.objects where bucket_id='stage-assets'),'owner sees only own storage object');

insert into public.stage_shows(id,owner_id,title,document) values ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','Own CRUD fixture','{"schemaVersion":1,"scenes":[],"tracks":[],"settings":{}}');
select pg_temp.stagecue_assert((select count(*)=1 from public.stage_shows where id='20000000-0000-4000-8000-000000000003'),'owner show insert');
update public.stage_shows set title='Own CRUD changed' where id='20000000-0000-4000-8000-000000000003';
select pg_temp.stagecue_assert((select revision=2 and title='Own CRUD changed' from public.stage_shows where id='20000000-0000-4000-8000-000000000003'),'owner show update and server revision');

insert into public.stage_assets(id,show_id,owner_id,path,name,mime_type,size) values ('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000003/three.png','three.png','image/png',42);
update public.stage_assets set name='renamed.png' where id='30000000-0000-4000-8000-000000000003';
select pg_temp.stagecue_assert((select name='renamed.png' from public.stage_assets where id='30000000-0000-4000-8000-000000000003'),'owner asset insert and update');
insert into storage.objects(bucket_id,name) values ('stage-assets','10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000003/three.png');
update storage.objects set metadata='{"test":true}' where bucket_id='stage-assets' and name='10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000003/three.png';
select pg_temp.stagecue_assert((select metadata->>'test'='true' from storage.objects where bucket_id='stage-assets' and name='10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000003/three.png'),'owner storage insert and update');

select pg_temp.stagecue_denied($sql$insert into public.stage_shows(owner_id,title,document) values ('10000000-0000-4000-8000-000000000002','forged','{"schemaVersion":1,"scenes":[],"tracks":[],"settings":{}}')$sql$,'cannot insert another owner show');
update public.stage_shows set owner_id='10000000-0000-4000-8000-000000000002' where id='20000000-0000-4000-8000-000000000003';
select pg_temp.stagecue_assert((select owner_id=auth.uid() from public.stage_shows where id='20000000-0000-4000-8000-000000000003'),'show owner immutable');
select pg_temp.stagecue_denied($sql$update public.stage_assets set owner_id='10000000-0000-4000-8000-000000000002' where id='30000000-0000-4000-8000-000000000003'$sql$,'cannot reassign asset owner');
select pg_temp.stagecue_denied($sql$update public.stage_assets set show_id='20000000-0000-4000-8000-000000000002' where id='30000000-0000-4000-8000-000000000003'$sql$,'cannot move asset to another owner show');
select pg_temp.stagecue_denied($sql$insert into storage.objects(bucket_id,name) values ('stage-assets','10000000-0000-4000-8000-000000000002/20000000-0000-4000-8000-000000000002/forged.png')$sql$,'storage rejects foreign user prefix');
select pg_temp.stagecue_denied($sql$insert into storage.objects(bucket_id,name) values ('stage-assets','10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000002/forged.png')$sql$,'storage rejects own prefix with foreign show');
select pg_temp.stagecue_denied($sql$insert into storage.objects(bucket_id,name) values ('stage-assets','10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000003/extra/forged.png')$sql$,'storage rejects extra path depth');
select pg_temp.stagecue_denied($sql$update storage.objects set name='10000000-0000-4000-8000-000000000002/20000000-0000-4000-8000-000000000002/moved.png' where bucket_id='stage-assets' and name='10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000003/three.png'$sql$,'storage update WITH CHECK rejects foreign destination');

-- Verify DELETE policy without direct object DELETE; actual file deletion must
-- be tested through Storage API with a real signed-in user's access token.
select pg_temp.stagecue_assert(pg_temp.stagecue_storage_delete_allowed('10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000003/three.png'),'owner storage DELETE policy allows own object');
select pg_temp.stagecue_assert(not pg_temp.stagecue_storage_delete_allowed('10000000-0000-4000-8000-000000000002/20000000-0000-4000-8000-000000000002/two.png'),'storage DELETE policy rejects foreign user prefix');
select pg_temp.stagecue_assert(not pg_temp.stagecue_storage_delete_allowed('10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000002/forged.png'),'storage DELETE policy rejects foreign show');
select pg_temp.stagecue_assert(not pg_temp.stagecue_storage_delete_allowed('10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000003/extra/forged.png'),'storage DELETE policy rejects nested path');
delete from public.stage_assets where id='30000000-0000-4000-8000-000000000003';
delete from public.stage_shows where id='20000000-0000-4000-8000-000000000003';
select pg_temp.stagecue_assert((select count(*)=0 from public.stage_shows where id='20000000-0000-4000-8000-000000000003'),'owner show delete');
select pg_temp.stagecue_assert((select count(*)=0 from public.stage_assets where id='30000000-0000-4000-8000-000000000003'),'owner asset delete');
select pg_temp.stagecue_assert(not pg_temp.stagecue_storage_delete_allowed('10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000003/three.png'),'storage DELETE policy rejects deleted parent show');

-- User 2 must not see/change/delete user 1's rows or storage.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select pg_temp.stagecue_assert((select count(*)=1 and bool_and(owner_id=auth.uid()) from public.stage_shows),'second user isolated show select');
select pg_temp.stagecue_assert((select count(*)=1 and bool_and(owner_id=auth.uid()) from public.stage_assets),'second user isolated asset select');
with changed as (update public.stage_shows set title='intrusion' where id='20000000-0000-4000-8000-000000000001' returning id) select pg_temp.stagecue_assert((select count(*)=0 from changed),'nonowner show update affects zero');
with changed as (delete from public.stage_shows where id='20000000-0000-4000-8000-000000000001' returning id) select pg_temp.stagecue_assert((select count(*)=0 from changed),'nonowner show delete affects zero');
with changed as (update public.stage_assets set name='intrusion.png' where id='30000000-0000-4000-8000-000000000001' returning id) select pg_temp.stagecue_assert((select count(*)=0 from changed),'nonowner asset update affects zero');
with changed as (delete from public.stage_assets where id='30000000-0000-4000-8000-000000000001' returning id) select pg_temp.stagecue_assert((select count(*)=0 from changed),'nonowner asset delete affects zero');
with changed as (update storage.objects set metadata='{"intrusion":true}' where bucket_id='stage-assets' and name='10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000001/one.png' returning id) select pg_temp.stagecue_assert((select count(*)=0 from changed),'nonowner storage update affects zero');
select pg_temp.stagecue_assert(not pg_temp.stagecue_storage_delete_allowed('10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000001/one.png'),'nonowner storage DELETE policy denied');
select pg_temp.stagecue_denied($sql$insert into public.stage_assets(show_id,owner_id,path,name,mime_type,size) values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002/20000000-0000-4000-8000-000000000001/forged.png','forged.png','image/png',42)$sql$,'nonowner cannot insert asset against foreign show');

reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{"role":"anon"}',true);
select pg_temp.stagecue_denied('select * from public.stage_shows','anon show SELECT denied');
select pg_temp.stagecue_denied($sql$insert into public.stage_shows(title,document) values ('anon','{"schemaVersion":1,"scenes":[],"tracks":[],"settings":{}}')$sql$,'anon show INSERT denied');
select pg_temp.stagecue_denied($sql$update public.stage_shows set title='anon'$sql$,'anon show UPDATE denied');
select pg_temp.stagecue_denied('delete from public.stage_shows','anon show DELETE denied');
select pg_temp.stagecue_denied('select * from public.stage_assets','anon asset SELECT denied');
select pg_temp.stagecue_denied($sql$insert into public.stage_assets(show_id,owner_id,path,name,mime_type,size) values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','forged.png','forged.png','image/png',42)$sql$,'anon asset INSERT denied');
select pg_temp.stagecue_denied($sql$update public.stage_assets set name='anon'$sql$,'anon asset UPDATE denied');
select pg_temp.stagecue_denied('delete from public.stage_assets','anon asset DELETE denied');
select pg_temp.stagecue_assert((select count(*)=0 from storage.objects where bucket_id='stage-assets'),'anon storage SELECT empty');
select pg_temp.stagecue_denied($sql$insert into storage.objects(bucket_id,name) values ('stage-assets','10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000001/anon.png')$sql$,'anon storage INSERT denied');
with changed as (update storage.objects set metadata='{}' where bucket_id='stage-assets' returning id) select pg_temp.stagecue_assert((select count(*)=0 from changed),'anon storage UPDATE affects zero');
select pg_temp.stagecue_assert(not pg_temp.stagecue_storage_delete_allowed('10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000001/one.png'),'anon storage DELETE policy denied');

reset role;
select pg_temp.stagecue_assert((select not public and file_size_limit=52428800 and not ('image/svg+xml'=any(allowed_mime_types)) from storage.buckets where id='stage-assets'),'bucket private50MiB and SVG excluded');
select pg_temp.stagecue_assert((select title='RLS fixture one' from public.stage_shows where id='20000000-0000-4000-8000-000000000001'),'attacked owner show unchanged');
select pg_temp.stagecue_assert((select name='one.png' from public.stage_assets where id='30000000-0000-4000-8000-000000000001'),'attacked owner asset unchanged');
select check_name, passed from stagecue_rls_results order by check_name;
rollback;

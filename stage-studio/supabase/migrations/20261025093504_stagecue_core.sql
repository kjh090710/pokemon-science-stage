-- StageCue Studio: owner-isolated shows, metadata, and private media.
create table public.stage_shows (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '' check (char_length(description) <= 2000),
  document jsonb not null check (jsonb_typeof(document) = 'object' and document->>'schemaVersion' = '1'),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);
create index stage_shows_owner_updated on public.stage_shows (owner_id, updated_at desc);

create table public.stage_assets (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  path text not null unique,
  name text not null check (char_length(name) between 1 and 255),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','image/gif','audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/wave','audio/ogg','audio/mp4','audio/x-m4a')),
  size bigint not null check (size > 0 and size <= 52428800),
  created_at timestamptz not null default now(),
  foreign key (show_id, owner_id) references public.stage_shows(id, owner_id) on delete cascade,
  check (split_part(path, '/', 1) = owner_id::text and split_part(path, '/', 2) = show_id::text and path ~ '^[^/]+/[^/]+/[^/]+$')
);
create index stage_assets_show_owner on public.stage_assets (show_id, owner_id);

create function public.stage_shows_touch() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.id := old.id;
  new.owner_id := old.owner_id;
  new.created_at := old.created_at;
  new.revision := old.revision + 1;
  new.updated_at := now();
  return new;
end;
$$;
create trigger stage_shows_touch before update on public.stage_shows for each row execute function public.stage_shows_touch();
revoke all on function public.stage_shows_touch() from public, anon, authenticated;

alter table public.stage_shows enable row level security;
alter table public.stage_assets enable row level security;
revoke all on public.stage_shows, public.stage_assets from anon;
grant select, insert, update, delete on public.stage_shows, public.stage_assets to authenticated;

create policy stage_shows_select on public.stage_shows for select to authenticated using ((select auth.uid()) = owner_id);
create policy stage_shows_insert on public.stage_shows for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy stage_shows_update on public.stage_shows for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy stage_shows_delete on public.stage_shows for delete to authenticated using ((select auth.uid()) = owner_id);

create policy stage_assets_select on public.stage_assets for select to authenticated using ((select auth.uid()) = owner_id and exists (select 1 from public.stage_shows s where s.id = show_id and s.owner_id = (select auth.uid())));
create policy stage_assets_insert on public.stage_assets for insert to authenticated with check ((select auth.uid()) = owner_id and exists (select 1 from public.stage_shows s where s.id = show_id and s.owner_id = (select auth.uid())));
create policy stage_assets_update on public.stage_assets for update to authenticated using ((select auth.uid()) = owner_id and exists (select 1 from public.stage_shows s where s.id = show_id and s.owner_id = (select auth.uid()))) with check ((select auth.uid()) = owner_id and exists (select 1 from public.stage_shows s where s.id = show_id and s.owner_id = (select auth.uid())));
create policy stage_assets_delete on public.stage_assets for delete to authenticated using ((select auth.uid()) = owner_id and exists (select 1 from public.stage_shows s where s.id = show_id and s.owner_id = (select auth.uid())));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('stage-assets','stage-assets',false,52428800,array['image/jpeg','image/png','image/webp','image/gif','audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/wave','audio/ogg','audio/mp4','audio/x-m4a']);

create policy stage_storage_select on storage.objects for select to authenticated using (
  bucket_id = 'stage-assets' and (storage.foldername(name))[1] = (select auth.uid())::text and array_length(storage.foldername(name),1) = 2 and
  exists (select 1 from public.stage_shows s where s.id::text = (storage.foldername(name))[2] and s.owner_id = (select auth.uid()))
);
create policy stage_storage_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'stage-assets' and (storage.foldername(name))[1] = (select auth.uid())::text and array_length(storage.foldername(name),1) = 2 and
  exists (select 1 from public.stage_shows s where s.id::text = (storage.foldername(name))[2] and s.owner_id = (select auth.uid()))
);
create policy stage_storage_update on storage.objects for update to authenticated using (
  bucket_id = 'stage-assets' and (storage.foldername(name))[1] = (select auth.uid())::text and array_length(storage.foldername(name),1) = 2 and
  exists (select 1 from public.stage_shows s where s.id::text = (storage.foldername(name))[2] and s.owner_id = (select auth.uid()))
) with check (
  bucket_id = 'stage-assets' and (storage.foldername(name))[1] = (select auth.uid())::text and array_length(storage.foldername(name),1) = 2 and
  exists (select 1 from public.stage_shows s where s.id::text = (storage.foldername(name))[2] and s.owner_id = (select auth.uid()))
);
create policy stage_storage_delete on storage.objects for delete to authenticated using (
  bucket_id = 'stage-assets' and (storage.foldername(name))[1] = (select auth.uid())::text and array_length(storage.foldername(name),1) = 2 and
  exists (select 1 from public.stage_shows s where s.id::text = (storage.foldername(name))[2] and s.owner_id = (select auth.uid()))
);

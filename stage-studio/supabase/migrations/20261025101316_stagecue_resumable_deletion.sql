-- Hide a show before deleting its private files. Keep its row until cleanup
-- finishes, allowing storage RLS to verify ownership during retries.
alter table public.stage_shows add column deletion_pending boolean not null default false;
create index stage_shows_owner_deletion_pending on public.stage_shows (owner_id, deletion_pending);

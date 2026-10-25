-- Tighten the original applied check without rewriting migration history.
alter table public.stage_shows drop constraint stage_shows_document_check;
alter table public.stage_shows add constraint stage_shows_document_check check (
  coalesce(
    jsonb_typeof(document) = 'object'
    and document @> '{"schemaVersion":1}'::jsonb
    and jsonb_typeof(document->'scenes') = 'array'
    and jsonb_typeof(document->'tracks') = 'array'
    and jsonb_typeof(document->'settings') = 'object',
    false
  )
);

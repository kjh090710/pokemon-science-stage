import type { MediaRef, MediaUrls, ShowDocument, ShowRecord, ShowSummary, UploadedAsset } from './model';
import { emptyDocument } from './model';
import { getSupabase } from './supabase';
import { parseMediaRef, parseShowDocument } from './validation';
import type { SupabaseClient } from '@supabase/supabase-js';

const bucket = 'stage-assets';
export const MAX_ASSET_BYTES = 50 * 1024 * 1024;
const mimeExtensions: Record<string, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'], 'image/png': ['png'], 'image/webp': ['webp'], 'image/gif': ['gif'],
  'audio/mpeg': ['mp3'], 'audio/mp3': ['mp3'], 'audio/wav': ['wav'], 'audio/x-wav': ['wav'], 'audio/wave': ['wav'],
  'audio/ogg': ['ogg'], 'audio/mp4': ['m4a'], 'audio/x-m4a': ['m4a'],
};
const message = (error: { message: string }, context: string) => new Error(`${context}: ${error.message}`);
const validTitle = (title: string) => { const t = title.trim(); if (!t || t.length > 160) throw new Error('공연 이름은 1~160자로 입력해 주세요.'); return t; };
const validDescription = (description: string) => { if (description.length > 2000) throw new Error('설명은 2,000자 이내로 입력해 주세요.'); return description; };
async function owner() {
  const client = getSupabase();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error('로그인이 필요합니다. 다시 로그인해 주세요.');
  return { client, userId: data.user.id };
}
function record(value: unknown): ShowRecord {
  const row = value as ShowRecord;
  return { ...row, document: parseShowDocument(row.document) };
}
export function collectMedia(document: ShowDocument): MediaRef[] {
  return [...document.tracks.map(t => t.source), ...document.scenes.flatMap(s => [...(s.background ? [s.background] : []), ...(s.effect?.frames ?? [])])];
}
function mapMedia(document: ShowDocument, replacements: Map<string, string>): ShowDocument {
  const ref = (r: MediaRef): MediaRef => r.type === 'storage' ? { type: 'storage', path: replacements.get(r.path) ?? r.path } : r;
  return { ...document, tracks: document.tracks.map(t => ({ ...t, source: ref(t.source) })), scenes: document.scenes.map(s => ({ ...s, background: s.background ? ref(s.background) : null, ...(s.effect ? { effect: { ...s.effect, frames: s.effect.frames.map(ref) } } : {}) })) };
}
export async function listShows(): Promise<ShowSummary[]> {
  const { client, userId } = await owner();
  const { data, error } = await client.from('stage_shows').select('id,title,description,document,revision,created_at,updated_at').eq('owner_id', userId).eq('deletion_pending', false).order('updated_at', { ascending: false });
  if (error) throw message(error, '공연 목록을 불러오지 못했습니다');
  retryPendingCleanup(client, userId);
  return (data ?? []).map(row => ({ ...row, document: parseShowDocument(row.document) })) as ShowSummary[];
}
export async function getShow(id: string): Promise<ShowRecord> {
  const { client, userId } = await owner();
  const { data, error } = await client.from('stage_shows').select('*').eq('id', id).eq('owner_id', userId).eq('deletion_pending', false).maybeSingle();
  if (error) throw message(error, '공연을 불러오지 못했습니다');
  if (!data) throw new Error('공연을 찾을 수 없거나 접근 권한이 없습니다.');
  return record(data);
}
export async function createShow(title: string, document: ShowDocument, description = ''): Promise<ShowRecord> {
  const { client, userId } = await owner();
  const { data, error } = await client.from('stage_shows').insert({ owner_id: userId, title: validTitle(title), description: validDescription(description), document: parseShowDocument(document) }).select('*').single();
  if (error) throw message(error, '공연을 만들지 못했습니다');
  return record(data);
}
export class RevisionConflictError extends Error {
  constructor() { super('다른 창에서 이 공연이 변경되었습니다. 현재 편집본을 내보낸 뒤 새로고침해 주세요.'); this.name = 'RevisionConflictError'; }
}
export async function saveShow(id: string, changes: { title: string; description: string; document: ShowDocument }, expectedRevision: number): Promise<ShowRecord> {
  if (!Number.isInteger(expectedRevision) || expectedRevision < 1) throw new RevisionConflictError();
  const { client, userId } = await owner();
  const { data, error } = await client.from('stage_shows').update({ title: validTitle(changes.title), description: validDescription(changes.description), document: parseShowDocument(changes.document) }).eq('id', id).eq('owner_id', userId).eq('deletion_pending', false).eq('revision', expectedRevision).select('*').maybeSingle();
  if (error) throw message(error, '공연을 저장하지 못했습니다');
  if (!data) throw new RevisionConflictError();
  return record(data);
}
export async function listAssets(showId: string): Promise<UploadedAsset[]> {
  const { client, userId } = await owner();
  const { data, error } = await client.from('stage_assets').select('*').eq('show_id', showId).eq('owner_id', userId).order('created_at', { ascending: false });
  if (error) throw message(error, '미디어 목록을 불러오지 못했습니다');
  return (data ?? []) as UploadedAsset[];
}
export function validateAssetFile(file: File): string {
  if (file.size <= 0 || file.size > MAX_ASSET_BYTES) throw new Error('파일 크기는 0바이트 초과, 50MB 이하여야 합니다.');
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const type = file.type.toLowerCase().split(';')[0] || Object.keys(mimeExtensions).find(m => mimeExtensions[m].includes(ext)) || '';
  if (!mimeExtensions[type]?.includes(ext)) throw new Error('JPG·PNG·WebP·GIF 이미지와 MP3·WAV·OGG·M4A 음원만 올릴 수 있습니다.');
  return type;
}
const safeFilename = (name: string) => name.normalize('NFKC').replace(/[^A-Za-z0-9_.-]/g, '_').replace(/^\.+/, '').slice(-150) || 'asset';
export async function uploadAsset(showId: string, file: File): Promise<MediaRef> {
  const mime = validateAssetFile(file);
  const { client, userId } = await owner();
  // Verify the parent before writing storage; RLS independently checks it again.
  await getShow(showId);
  const path = `${userId}/${showId}/${crypto.randomUUID()}-${safeFilename(file.name)}`;
  const { error: uploadError } = await client.storage.from(bucket).upload(path, file, { contentType: mime, upsert: false, cacheControl: '3600' });
  if (uploadError) throw message(uploadError, '미디어 업로드에 실패했습니다');
  const { error } = await client.from('stage_assets').insert({ show_id: showId, owner_id: userId, path, name: file.name.slice(0, 255), mime_type: mime, size: file.size });
  if (error) { await client.storage.from(bucket).remove([path]); throw message(error, '미디어 정보를 저장하지 못했습니다'); }
  return { type: 'storage', path };
}
export async function duplicateShow(show: ShowSummary | ShowRecord): Promise<ShowRecord> {
  const source = await getShow(show.id);
  const { client, userId } = await owner();
  const copy = await createShow(`${source.title.slice(0, 154)} 복사본`, emptyDocument(), source.description);
  const replacements = new Map<string, string>();
  const paths = [...new Set(collectMedia(source.document).filter((r): r is { type: 'storage'; path: string } => r.type === 'storage').map(r => r.path))];
  try {
    if (paths.length) {
      const { data: assets, error } = await client.from('stage_assets').select('*').eq('owner_id', userId).in('path', paths);
      if (error) throw error;
      for (const path of paths) {
        const asset = (assets as UploadedAsset[] | null)?.find(a => a.path === path);
        if (!asset) throw new Error('복제할 미디어 정보를 찾을 수 없습니다.');
        const destination = `${userId}/${copy.id}/${crypto.randomUUID()}-${safeFilename(asset.name)}`;
        const { error: copyError } = await client.storage.from(bucket).copy(path, destination);
        if (copyError) throw copyError;
        const { error: metadataError } = await client.from('stage_assets').insert({ show_id: copy.id, owner_id: userId, path: destination, name: asset.name, mime_type: asset.mime_type, size: asset.size });
        if (metadataError) { await client.storage.from(bucket).remove([destination]); throw metadataError; }
        replacements.set(path, destination);
      }
    }
    return await saveShow(copy.id, { title: copy.title, description: copy.description, document: mapMedia(source.document, replacements) }, copy.revision);
  } catch (error) {
    await deleteShow(copy.id).catch(() => {});
    throw error;
  }
}
const cleanupJobs = new Set<string>();
/** Keep the parent row until file removal succeeds, so storage RLS stays valid. */
async function finishDeletion(client: SupabaseClient, userId: string, id: string): Promise<void> {
  const prefix = `${userId}/${id}/`;
  // Read every metadata page rather than silently leaving assets after row 1000.
  const paths: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from('stage_assets').select('path').eq('show_id', id).eq('owner_id', userId).order('id').range(offset, offset + 999);
    if (error) throw error;
    const page = data ?? [];
    for (const asset of page) { if (!asset.path.startsWith(prefix)) throw new Error('미디어 소유 경로가 올바르지 않습니다.'); paths.push(asset.path); }
    if (page.length < 1000) break;
  }
  for (let offset = 0; offset < paths.length; offset += 100) {
    const { error } = await client.storage.from(bucket).remove(paths.slice(offset, offset + 100));
    if (error) throw error;
  }
  const { error } = await client.from('stage_shows').delete().eq('id', id).eq('owner_id', userId).eq('deletion_pending', true);
  if (error) throw error;
}
function retryPendingCleanup(client: SupabaseClient, userId: string) {
  if (cleanupJobs.has(userId)) return;
  cleanupJobs.add(userId);
  void (async () => {
    const { data, error } = await client.from('stage_shows').select('id').eq('owner_id', userId).eq('deletion_pending', true);
    if (error) return;
    for (const row of data ?? []) await finishDeletion(client, userId, row.id).catch(() => {});
  })().catch(() => {}).finally(() => { cleanupJobs.delete(userId); });
}
export async function deleteShow(id: string): Promise<{ cleanupPending: boolean }> {
  const { client, userId } = await owner();
  const { data: show, error: readError } = await client.from('stage_shows').select('id,deletion_pending').eq('id', id).eq('owner_id', userId).maybeSingle();
  if (readError) throw message(readError, '공연을 확인하지 못했습니다');
  if (!show) return { cleanupPending: false };
  const prefix = `${userId}/${id}/`;
  if (!show.deletion_pending) {
    const { data: others, error: othersError } = await client.from('stage_shows').select('id,document').eq('owner_id', userId).eq('deletion_pending', false).neq('id', id);
    if (othersError) throw message(othersError, '미디어 참조를 확인하지 못했습니다');
    if ((others ?? []).some(s => collectMedia(s.document as ShowDocument).some(r => r.type === 'storage' && r.path.startsWith(prefix)))) throw new Error('이 공연의 미디어를 다른 공연이 참조하고 있어 삭제할 수 없습니다. 다른 공연에서 해당 파일을 다시 업로드해 주세요.');
    const { error } = await client.from('stage_shows').update({ deletion_pending: true }).eq('id', id).eq('owner_id', userId);
    if (error) throw message(error, '공연을 삭제 목록으로 옮기지 못했습니다');
  }
  try { await finishDeletion(client, userId, id); return { cleanupPending: false }; }
  catch { return { cleanupPending: true }; }
}
export async function resolveMedia(document: ShowDocument): Promise<MediaUrls> {
  // Draft titles and audio selections may be incomplete while an upload finishes.
  // Validate only the media references here; save/import still validate the show.
  const paths = [...new Set(collectMedia(document).map(parseMediaRef).filter((r): r is { type: 'storage'; path: string } => r.type === 'storage').map(r => r.path))];
  if (!paths.length) return {};
  const { client } = await owner();
  const { data, error } = await client.storage.from(bucket).createSignedUrls(paths, 12 * 60 * 60);
  if (error) throw message(error, '미디어를 불러오지 못했습니다');
  const urls: MediaUrls = {};
  for (const entry of data ?? []) { if (entry.error || !entry.signedUrl || !entry.path) throw new Error('공연의 미디어 일부를 불러오지 못했습니다. 파일과 접근 권한을 확인해 주세요.'); urls[entry.path] = entry.signedUrl; }
  return urls;
}

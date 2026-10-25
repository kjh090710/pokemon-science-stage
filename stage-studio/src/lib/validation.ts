import type { MediaRef, Scene, ShowDocument, Track } from './model';

const fail = (message: string): never => { throw new Error(`공연 파일 형식 오류: ${message}`); };
const object = (v: unknown, at: string): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : fail(`${at}를 확인해 주세요.`);
function text(v: unknown, at: string, max: number, min = 0): string { return typeof v === 'string' && v.length >= min && v.length <= max ? v : fail(`${at} 길이를 확인해 주세요.`); }
function number(v: unknown, at: string, min: number, max: number): number { return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : fail(`${at} 범위를 확인해 주세요.`); }
function choice<T extends string>(v: unknown, options: readonly T[], at: string): T { return typeof v === 'string' && options.includes(v as T) ? v as T : fail(`${at} 값이 올바르지 않습니다.`); }
function bool(v: unknown, at: string): boolean { return typeof v === 'boolean' ? v : fail(`${at} 값이 올바르지 않습니다.`); }
const id = (v: unknown, at: string) => { const s = text(v, at, 120, 1); return /^[A-Za-z0-9_-]+$/.test(s) ? s : fail(`${at} 문자가 올바르지 않습니다.`); };
function media(v: unknown, at: string): MediaRef {
  const r = object(v, at);
  if (r.type === 'storage') {
    const path = text(r.path, at, 800, 1);
    if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[A-Za-z0-9_.-]+$/i.test(path) || path.split('/').some(p => p === '.' || p === '..')) fail(`${at} 저장 경로가 올바르지 않습니다.`);
    return { type: 'storage', path };
  }
  if (r.type !== 'url') return fail(`${at} 미디어 형식이 올바르지 않습니다.`);
  const url = text(r.url, at, 4000, 1);
  if (/[\u0000-\u0020\\]/.test(url) || /\.svg(?:$|[?#])/i.test(url)) fail(`${at}에는 안전한 이미지·음원 주소만 사용할 수 있습니다.`);
  if (url.startsWith('/') && !url.startsWith('//')) return { type: 'url', url };
  try { const parsed = new URL(url); if (['https:', 'http:'].includes(parsed.protocol) && !parsed.username && !parsed.password) return { type: 'url', url: parsed.href }; } catch { /* fail below */ }
  return fail(`${at} 주소는 http(s) 또는 /로 시작해야 합니다.`);
}
export const parseMediaRef = (value: unknown): MediaRef => media(value, '미디어');

/** Validate and rebuild known fields only; imported JSON never becomes executable HTML. */
export function parseShowDocument(value: unknown): ShowDocument {
  const d = object(value, '공연');
  if (d.schemaVersion !== 1) fail('지원하지 않는 버전입니다.');
  if (!Array.isArray(d.scenes) || d.scenes.length < 1 || d.scenes.length > 500) fail('장면은 1~500개여야 합니다.');
  if (!Array.isArray(d.tracks) || d.tracks.length > 100) fail('음원은 100개까지 넣을 수 있습니다.');
  const trackIds = new Set<string>();
  const tracks: Track[] = (d.tracks as unknown[]).map((v, i) => {
    const t = object(v, `음원 ${i + 1}`), key = id(t.id, '음원 ID');
    if (trackIds.has(key)) fail('음원 ID가 중복되었습니다.'); trackIds.add(key);
    return { id: key, label: text(t.label, '음원 이름', 160, 1), source: media(t.source, '음원'), volume: number(t.volume, '음원 음량', 0, 1), loop: bool(t.loop, '반복 재생'), fadeInMs: number(t.fadeInMs, '페이드인', 0, 30000) };
  });
  const sceneIds = new Set<string>();
  const scenes: Scene[] = (d.scenes as unknown[]).map((v, i) => {
    const s = object(v, `장면 ${i + 1}`), key = id(s.id, '장면 ID'), transition = object(s.transition, '장면 전환'), audio = object(s.audio, '장면 음향');
    if (sceneIds.has(key)) fail('장면 ID가 중복되었습니다.'); sceneIds.add(key);
    const action = choice(audio.action, ['play', 'stop', 'keep'], '음향 동작');
    const trackId = audio.trackId === undefined ? undefined : id(audio.trackId, '음원 연결');
    if (action === 'play' && (!trackId || !trackIds.has(trackId))) fail('재생할 음원이 없습니다.');
    if (trackId && !trackIds.has(trackId)) fail('연결된 음원을 찾을 수 없습니다.');
    const scene: Scene = { id: key, title: text(s.title, '장면 이름', 160, 1), note: text(s.note, '진행 메모', 10000), background: s.background === null ? null : media(s.background, '배경'), blackout: bool(s.blackout, '암전'), fit: choice(s.fit, ['cover', 'contain'], '배경 크기'), position: choice(s.position, ['center', 'right', 'left'], '배경 위치'), transition: { kind: choice(transition.kind, ['cut', 'fade'], '전환 효과'), durationMs: number(transition.durationMs, '전환 시간', 0, 60000) }, audio: { action, ...(trackId ? { trackId } : {}) } };
    if (s.effect !== undefined) {
      const e = object(s.effect, '문 효과'); if (e.type !== 'gate' || !Array.isArray(e.frames) || e.frames.length < 1 || e.frames.length > 60) fail('문 효과 프레임을 확인해 주세요.');
      scene.effect = { type: 'gate', frames: (e.frames as unknown[]).map((f: unknown) => media(f, '문 프레임')), durationMs: number(e.durationMs, '문 효과 시간', 100, 60000) };
    }
    return scene;
  });
  const settings = object(d.settings, '공연 설정');
  return { schemaVersion: 1, scenes, tracks, settings: { aspectRatio: choice(settings.aspectRatio, ['16:9', '4:3'], '화면 비율'), masterVolume: number(settings.masterVolume, '전체 음량', 0, 1), fadeOutMs: number(settings.fadeOutMs, '페이드아웃', 0, 30000) } };
}
export const stringifyShowDocument = (document: ShowDocument) => JSON.stringify(parseShowDocument(document), null, 2);

import type {MediaUrls, ShowDocument} from './model';

export interface StageState {
  showId:string;
  title:string;
  document:ShowDocument;
  mediaUrls:MediaUrls;
  index:number;
  revision:number;
  emergency:boolean;
  startAt?:number;
  gatePending?:boolean;
}

export type StageCommand = 'next'|'prev'|'blackout';
export type StageMessage =
  | {type:'hello';session:string;showId:string}
  | {type:'state';session:string;state:StageState}
  | {type:'command';session:string;showId:string;action:StageCommand}
  | {type:'closed';session:string;showId:string};

export const validSession = (session:string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(session);

export function createStageChannel(showId:string, session:string):BroadcastChannel|null {
  if (!validSession(session) || !showId || typeof BroadcastChannel === 'undefined') return null;
  return new BroadcastChannel(`stagecue-run:${showId}:${session}`);
}

export function isStageMessage(value:unknown):value is StageMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Record<string,unknown>;
  if (typeof message.session !== 'string' || !validSession(message.session)) return false;
  if (message.type === 'state') {
    const state = message.state as Partial<StageState>|undefined;
    return !!state && typeof state.showId === 'string' && Number.isInteger(state.index) &&
      Number.isInteger(state.revision) && typeof state.emergency === 'boolean' &&
      !!state.document && Array.isArray(state.document.scenes) && !!state.mediaUrls;
  }
  if (typeof message.showId !== 'string') return false;
  if (message.type === 'command') return ['next','prev','blackout'].includes(String(message.action));
  return message.type === 'hello' || message.type === 'closed';
}

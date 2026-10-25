export type MediaRef = {type:'url';url:string}|{type:'storage';path:string};
export type ImageFit = 'cover'|'contain';
export type ImagePosition = 'center'|'right'|'left';
export type SceneAudio = {action:'play'|'stop'|'keep';trackId?:string};
export interface Scene { id:string; title:string; note:string; background:MediaRef|null; blackout:boolean; fit:ImageFit; position:ImagePosition; transition:{kind:'cut'|'fade';durationMs:number}; audio:SceneAudio; effect?:{type:'gate';frames:MediaRef[];durationMs:number}; }
export interface Track {id:string;label:string;source:MediaRef;volume:number;loop:boolean;fadeInMs:number;}
export interface ShowDocument {schemaVersion:1;scenes:Scene[];tracks:Track[];settings:{aspectRatio:'16:9'|'4:3';masterVolume:number;fadeOutMs:number};}
export interface ShowRecord {id:string;owner_id:string;title:string;description:string;document:ShowDocument;revision:number;created_at:string;updated_at:string;}
export interface ShowSummary {id:string;title:string;description:string;updated_at:string;created_at:string;revision:number;document:ShowDocument;}
export interface UploadedAsset {id:string;show_id:string;owner_id:string;path:string;name:string;mime_type:string;size:number;created_at:string;}
export type MediaUrls = Record<string,string>;
export const mediaKey=(ref:MediaRef)=>ref.type==='storage'?ref.path:ref.url;
export const mediaUrl=(ref:MediaRef|null|undefined,urls:MediaUrls={})=>!ref?'':ref.type==='url'?ref.url:(urls[ref.path]||'');
export const newId=()=>crypto.randomUUID();
export const createScene=():Scene=>({id:newId(),title:'새 장면',note:'',background:null,blackout:false,fit:'cover',position:'center',transition:{kind:'fade',durationMs:800},audio:{action:'stop'}});
export const emptyDocument=():ShowDocument=>({schemaVersion:1,scenes:[createScene()],tracks:[],settings:{aspectRatio:'16:9',masterVolume:.75,fadeOutMs:2500}});
export interface EditorProps {show:ShowRecord;onChange:(document:ShowDocument)=>void;onTitleChange:(title:string)=>void;onSave:()=>Promise<void>;saving:boolean;dirty:boolean;error:string|null;mediaUrls:MediaUrls;onUpload:(file:File)=>Promise<MediaRef>;onBack:()=>void;onStart:()=>void;}
export interface ControllerProps {show:ShowRecord;mediaUrls:MediaUrls;onBack:()=>void;}

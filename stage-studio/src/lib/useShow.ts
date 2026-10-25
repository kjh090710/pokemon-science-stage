import {useCallback,useEffect,useRef,useState} from 'react';
import type {MediaRef,MediaUrls,ShowDocument,ShowRecord} from './model';
import {collectMedia,getShow,resolveMedia,saveShow,uploadAsset} from './repository';
export const showFingerprint=(show:ShowRecord)=>JSON.stringify([show.title,show.description,show.document]);
export function useShow(id:string){
 const [show,setShow]=useState<ShowRecord|null>(null);
 const [loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null);
 const [saving,setSaving]=useState(false),[saved,setSaved]=useState('');
 const [mediaUrls,setMediaUrls]=useState<MediaUrls>({});
 const [mediaReadySignature,setMediaReadySignature]=useState<string|null>(null);
 const [mediaError,setMediaError]=useState<string|null>(null);
 const current=useRef(show);current.current=show;
 const savedRef=useRef('');
 const pendingSave=useRef<Promise<void>|null>(null);
 useEffect(()=>{
  let alive=true;setLoading(true);setError(null);
  getShow(id).then(value=>{if(alive){current.current=value;setShow(value);savedRef.current=showFingerprint(value);setSaved(savedRef.current);}})
   .catch(reason=>{if(alive)setError(reason instanceof Error?reason.message:'작품을 불러오지 못했습니다.');})
   .finally(()=>{if(alive)setLoading(false);});
  return()=>{alive=false;};
 },[id]);
 const mediaSignature=show?collectMedia(show.document).map(ref=>ref.type==='storage'?ref.path:ref.url).sort().join('|'):'';
 useEffect(()=>{
  if(!current.current)return;
  let alive=true;setMediaError(null);
  resolveMedia(current.current.document).then(urls=>{if(alive){setMediaUrls(urls);setMediaReadySignature(mediaSignature);}})
   .catch(reason=>{if(alive){setMediaError(reason instanceof Error?reason.message:'파일을 불러오지 못했습니다.');setMediaReadySignature(mediaSignature);}});
  return()=>{alive=false;};
 },[mediaSignature]);
 const mediaLoading=!!show&&mediaReadySignature!==mediaSignature;
 const dirty=!!show&&showFingerprint(show)!==saved;
 useEffect(()=>{
  if(!dirty)return;
  const before=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
  window.addEventListener('beforeunload',before);return()=>window.removeEventListener('beforeunload',before);
 },[dirty]);
 const save=useCallback(async function persist():Promise<void>{
  if(pendingSave.current){
   await pendingSave.current;
   if(current.current&&showFingerprint(current.current)!==savedRef.current)await persist();
   return;
  }
  const snapshot=current.current;if(!snapshot)return;
  setSaving(true);setError(null);
  const task=(async()=>{
   const record=await saveShow(snapshot.id,{title:snapshot.title,description:snapshot.description,document:snapshot.document},snapshot.revision);
   savedRef.current=showFingerprint(record);setSaved(savedRef.current);
   const latest=current.current;
   if(latest?.id===record.id){const next={...latest,revision:record.revision,updated_at:record.updated_at};current.current=next;setShow(next);}
  })();
  pendingSave.current=task;
  try{await task;}catch(reason){setError(reason instanceof Error?reason.message:'저장하지 못했습니다.');throw reason;}
  finally{pendingSave.current=null;setSaving(false);}
 },[]);
 const change=useCallback((document:ShowDocument)=>setShow(value=>{const next=value?{...value,document}:value;current.current=next;return next;}),[]);
 const title=useCallback((title:string)=>setShow(value=>{const next=value?{...value,title}:value;current.current=next;return next;}),[]);
 const upload=useCallback(async(file:File):Promise<MediaRef>=>uploadAsset(id,file),[id]);
 return {show,loading,error:error||mediaError,saving,dirty,mediaUrls,mediaLoading,mediaError,save,change,title,upload};
}
